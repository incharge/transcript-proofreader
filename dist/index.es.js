/**
 * name: @incharge/transcript-proofreader
 * description: Work in progress - A UI component for proofreading and editing transcripts
 * author: Julian Price, inCharge Ltd
 * repository: git+https://github.com/incharge/transcript-proofreader
 */
const fs = {};
function htmlEncode(input) {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function wordBackgroundColor(word, isCurrent = false) {
  let confidence = word.confidence || 0.99;
  if (isCurrent) {
    return "#FFFF33";
  } else if (word.filler === true) {
    return "#cccccc";
  } else if (word.start_time === void 0 || confidence > 0.99) {
    return "";
  } else {
    const minimumColor = 99;
    confidence = Math.floor(confidence * (256 - minimumColor)) + minimumColor;
    const color = (confidence < 16 ? "0" : "") + confidence.toString(16);
    return "#FF" + color + color;
  }
}
function secondsToHms(time) {
  let from;
  if (time == void 0) {
    return "";
  }
  if (time < 60 * 60) {
    from = 14;
  } else if (time < 60 * 60 * 10) {
    from = 12;
  } else {
    from = 11;
  }
  return new Date(Math.floor(time) * 1e3).toISOString().substring(from, 19);
}
class ProofreadTranscript {
  constructor() {
    this.getCurrentLineWords = () => {
      if (this.currentLine < this.transcript.lines.length) {
        return this.transcript.lines[this.currentLine].words;
      } else {
        return [];
      }
    };
    this.currentLine = 0;
    this.currentWord = 0;
    this.isBetween = true;
    this.lastEnd = 0;
    this.transcript = { url: "", speakers: [], lines: [] };
  }
  logState() {
    console.log(`State: line=${this.currentLine}, word=${this.currentWord}, isBetween=${this.isBetween}, lastEnd=${this.lastEnd}`);
  }
  logWord(lineIndex, wordIndex) {
    const word = this.getWord(lineIndex, wordIndex);
    console.log(`Word: ${lineIndex}-${wordIndex} '${word.content}' colour=${this.getBackgroundColor(lineIndex, wordIndex)}`);
  }
  loaded() {
    this.currentLine = 0;
    this.currentWord = 0;
    this.isBetween = true;
    this.lastEnd = 0;
  }
  // Set the transcript by passing in a TranscriptSchema object.  Useful for testing.
  load(transcript) {
    this.transcript = transcript;
    this.loaded();
  }
  getUrl() {
    return this.transcript.url;
  }
  // Get the name of the speaker of the given line
  getSpeakerName(lineIndex = this.currentLine) {
    let speakerName = "";
    if (lineIndex >= 0 && lineIndex < this.transcript.lines.length) {
      const speakerIndex = this.transcript.lines[lineIndex].speaker;
      if (speakerIndex >= 0 && speakerIndex < this.transcript.speakers.length) {
        speakerName = this.transcript.speakers[speakerIndex];
      }
    }
    return speakerName;
  }
  getWord(lineIndex, wordIndex) {
    if (lineIndex < this.transcript.lines.length) {
      let line = this.transcript.lines[lineIndex];
      if (wordIndex < line.words.length)
        return line.words[wordIndex];
    }
    return { confidence: 0, content: "", start_time: 0, end_time: 0 };
  }
  getPreviousWordIndex(lineWord) {
    let [lineIndex, wordIndex] = lineWord;
    if (wordIndex == 0) {
      if (lineIndex > 0) {
        lineIndex--;
        wordIndex = this.transcript.lines[lineIndex].words.length - 1;
      }
    } else {
      wordIndex--;
    }
    return [lineIndex, wordIndex];
  }
  // Get the end time of the given word.
  getEndTime(lineWord) {
    let [lineIndex, wordIndex] = lineWord;
    let word;
    let isPrevious = false;
    do {
      if (isPrevious) {
        [lineIndex, wordIndex] = this.getPreviousWordIndex([lineIndex, wordIndex]);
      }
      isPrevious = true;
      word = this.getWord(lineIndex, wordIndex);
    } while (word.end_time === void 0);
    return word.end_time;
  }
  // Get the start time of the given word.
  getStartTime(lineWord) {
    let [lineIndex, wordIndex] = lineWord;
    let word;
    let isPrevious = false;
    do {
      if (isPrevious) {
        [lineIndex, wordIndex] = this.getPreviousWordIndex([lineIndex, wordIndex]);
      }
      isPrevious = true;
      word = this.getWord(lineIndex, wordIndex);
    } while (word.start_time === void 0);
    return word.start_time;
  }
  getNextWordIndex(lineWord) {
    let [lineIndex, wordIndex] = lineWord;
    if (wordIndex >= this.transcript.lines[lineIndex].words.length - 1) {
      if (this.currentLine < this.transcript.lines.length - 1) {
        lineIndex++;
        wordIndex = 0;
      }
    } else {
      wordIndex++;
    }
    return [lineIndex, wordIndex];
  }
  rewindToWord(line, wordIndex) {
    while (line.words[wordIndex].end_time === void 0 && wordIndex > 0) {
      wordIndex--;
    }
    return wordIndex;
  }
  forwardToWord(line, wordIndex) {
    while (line.words[wordIndex].end_time === void 0 && wordIndex < line.words.length) {
      wordIndex++;
    }
    return wordIndex;
  }
  lookupCurrentTime(time) {
    let lowIndex = 0;
    let highIndex = this.transcript.lines.length - 1;
    let middleIndex;
    let line;
    if (lowIndex > highIndex)
      return;
    while (lowIndex != highIndex) {
      middleIndex = Math.floor((lowIndex + highIndex) / 2);
      line = this.transcript.lines[middleIndex];
      let wordIndex = this.rewindToWord(line, line.words.length - 1);
      if (time > line.words[wordIndex].end_time) {
        lowIndex = middleIndex + 1;
      } else {
        highIndex = middleIndex;
      }
    }
    this.currentLine = lowIndex;
    line = this.transcript.lines[this.currentLine];
    lowIndex = 0;
    highIndex = this.rewindToWord(line, line.words.length - 1);
    if (lowIndex > highIndex)
      return;
    while (lowIndex != highIndex) {
      middleIndex = this.rewindToWord(line, Math.floor((lowIndex + highIndex) / 2));
      if (time > line.words[middleIndex].end_time) {
        lowIndex = this.forwardToWord(line, middleIndex + 1);
      } else {
        highIndex = middleIndex;
      }
    }
    this.currentWord = lowIndex;
    this.isBetween = time < line.words[lowIndex].start_time;
    this.lastEnd = this.getEndTime(this.getPreviousWordIndex([this.currentLine, this.currentWord]));
  }
  // Set the current line/word etc for the given time
  // Returns true if it was necessary to do a full search
  setCurrentTime(time) {
    if (time < this.lastEnd || time > this.lastEnd + 10) {
      this.lookupCurrentTime(time);
      return true;
    }
    let word;
    let lineIndex = this.currentLine;
    let wordIndex = this.currentWord;
    let isFound = false;
    do {
      word = this.getWord(lineIndex, wordIndex);
      if (word.end_time !== void 0) {
        if (time <= word.end_time) {
          isFound = true;
          this.isBetween = time < word.start_time;
        }
      }
      if (isFound) {
        this.currentLine = lineIndex;
        this.currentWord = wordIndex;
      } else {
        if (word.end_time !== void 0) {
          this.lastEnd = word.end_time;
        }
        [lineIndex, wordIndex] = this.getNextWordIndex([lineIndex, wordIndex]);
      }
    } while (!isFound);
    return false;
  }
  isCurrent(lineIndex, wordIndex) {
    return lineIndex == this.currentLine && this.currentWord == wordIndex;
  }
  getBackgroundColor(lineIndex, wordIndex) {
    const word = this.getWord(lineIndex, wordIndex);
    return wordBackgroundColor(word, this.isCurrent(lineIndex, wordIndex));
  }
}
class ProofreadDom extends ProofreadTranscript {
  constructor() {
    super();
    this.handleLoadButtonClick = async (event) => {
      if (event.type === "click") {
        const el = document.getElementById(this.prefix + "-transcript-url");
        if (el) {
          await this.load(el.value);
        }
      }
    };
    this.handleTimeupdate = async (event) => {
      const audio = event.target;
      const currentTime = audio.currentTime;
      this.setCurrentTime(currentTime);
    };
    this.handleSkipButtonClick = (event) => {
      if (event.type === "click") {
        const offsetInput = document.getElementById(this.prefix + "-offset");
        this.skipTo(parseInt(offsetInput == null ? void 0 : offsetInput.value));
      }
    };
    this.handleSelectLine = (event) => {
      const optionElement = event.target;
      this.skipTo(parseInt(optionElement == null ? void 0 : optionElement.value));
    };
    this.handleLineButton = (event) => {
      const buttonElement = event.target;
      const lineIndex = this.currentLine + (buttonElement.id == this.prefix + "-prev-line" ? -1 : 1);
      if (lineIndex >= 0 && lineIndex < this.transcript.lines.length) {
        const word = this.getWord(lineIndex, 0);
        this.skipTo(word.start_time);
      }
    };
    this.handeRwFfButton = (event) => {
      const buttonElement = event.target;
      const audioElement = document.getElementById(this.prefix + "-audio");
      if (audioElement && buttonElement) {
        let seconds = parseInt(buttonElement.getAttribute("data-seconds") || "");
        console.log(seconds);
        seconds = isNaN(seconds) ? buttonElement.id == this.prefix + "-rw-btn" ? -5 : 15 : seconds;
        const time = audioElement.currentTime + seconds;
        this.skipTo(time);
      }
    };
    this.handleClickWord = (event) => {
      const element = event.target;
      let wordIndex = this.wordIdToWordIndex(element.id);
      if (isNaN(wordIndex)) {
        wordIndex = this.transcript.lines[this.currentLine].words.length - 1;
      }
      this.skipTo(this.getStartTime([this.currentLine, wordIndex]));
    };
    this.prefix = "ic";
  }
  // Set the transcript by passing in the URL of a transcript file or a TranscriptSchema object.
  async load(transcript) {
    if (typeof transcript === "string") {
      const response = await window.fetch(transcript);
      this.transcript = await response.json();
    } else {
      super.load(transcript);
    }
    this.loaded();
    this.updateLine();
    const url = this.getUrl();
    if (url != "") {
      const audioElement = document.getElementById(this.prefix + "-audio");
      if (audioElement) {
        audioElement.src = url;
      }
    }
    const selectElement = document.getElementById(this.prefix + "-select-line");
    if (selectElement) {
      let html = "";
      for (let lineIndex = 0; lineIndex < this.transcript.lines.length; lineIndex++) {
        const offset = this.transcript.lines[lineIndex].words[0].start_time;
        html += `<option value="${offset}">${secondsToHms(offset)} ${htmlEncode(this.getSpeakerName(lineIndex))}</option>`;
      }
      selectElement.innerHTML = html;
    }
  }
  attachButton(id, eventHandler) {
    let element = document.getElementById(this.prefix + id);
    if (element) {
      element.addEventListener("click", eventHandler);
    }
  }
  attach(url, prefix = "ic") {
    this.prefix = prefix;
    let element;
    const el = document.getElementById(prefix + "-transcript-url");
    if (el) {
      if (url) {
        el.value = url;
      } else if (el.value) {
        url = el.value;
      }
    }
    element = document.getElementById(this.prefix + "-audio");
    if (element) {
      element.addEventListener("timeupdate", this.handleTimeupdate);
      if (url) {
        this.load(url);
      }
    }
    this.attachButton("-load", this.handleLoadButtonClick);
    this.attachButton("-skip-to-offset", this.handleSkipButtonClick);
    this.attachButton("-prev-line", this.handleLineButton);
    this.attachButton("-next-line", this.handleLineButton);
    this.attachButton("-rw-btn", this.handeRwFfButton);
    this.attachButton("-ff-btn", this.handeRwFfButton);
    element = document.getElementById(this.prefix + "-select-line");
    if (element) {
      element.addEventListener("change", this.handleSelectLine);
    }
    element = document.getElementById(this.prefix + "-line");
    if (element) {
      element.addEventListener("click", this.handleClickWord);
    }
  }
  // The current line has changed. Update the UI accordingly
  updateLine() {
    let container;
    container = document.getElementById(this.prefix + "-speaker");
    if (container) {
      container.innerText = this.getSpeakerName();
    }
    container = document.getElementById(this.prefix + "-line");
    if (container) {
      const words = this.getCurrentLineWords();
      let html = "";
      let backgroundColor;
      for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
        let word = words[wordIndex];
        backgroundColor = this.getBackgroundColor(this.currentLine, wordIndex);
        if (backgroundColor != "") {
          backgroundColor = ` style='background-color: ${backgroundColor}'`;
        }
        html += (word.start_time !== void 0 ? " " : "") + `<span id="${this.prefix}-word-${wordIndex}"${backgroundColor}>${htmlEncode(word.content)}</span>`;
      }
      container.innerHTML = html;
    }
    const selectElement = document.getElementById(this.prefix + "-select-line");
    if (selectElement) {
      selectElement.selectedIndex = this.currentLine;
    }
  }
  setBackgroundColor(lineIndex, wordIndex) {
    const span = document.getElementById(this.prefix + "-word-" + String(wordIndex));
    span.style.setProperty("background-color", this.getBackgroundColor(lineIndex, wordIndex), "");
  }
  setCurrentTime(currentTime) {
    const beforeMonlogueIndex = this.currentLine;
    const beforeWordIndex = this.currentWord;
    const beforeIssBetween = this.isBetween;
    const isSeek = super.setCurrentTime(currentTime);
    if (beforeMonlogueIndex != this.currentLine) {
      this.updateLine();
    } else if (beforeWordIndex != this.currentWord || beforeIssBetween != this.isBetween) {
      this.setBackgroundColor(beforeMonlogueIndex, beforeWordIndex);
      this.setBackgroundColor(this.currentLine, this.currentWord);
    }
    return isSeek;
  }
  skipTo(offset) {
    offset = isNaN(offset) ? 0 : offset;
    const audioElement = document.getElementById(this.prefix + "-audio");
    if (audioElement) {
      audioElement.currentTime = offset;
    }
  }
  wordIdToWordIndex(wordId) {
    return parseInt(wordId.substring(this.prefix.length + 6));
  }
}
class ProofreadFilesystem extends ProofreadTranscript {
  async load(transcript) {
    if (typeof transcript === "string") {
      this.transcript = JSON.parse(await fs.readFile(transcript, "utf-8"));
      this.loaded();
    } else {
      super.load(transcript);
    }
  }
}
export {
  ProofreadDom,
  ProofreadFilesystem,
  ProofreadTranscript
};
