import fs from 'node:fs/promises';
import { htmlEncode, secondsToHms, wordBackgroundColor, type TranscriptSchema, type TranscriptLine, type TranscriptWord } from "@incharge/transcript-core"

type EventHandler = (event: Event) => void;

type LineWord = [lineIndex: number, wordIndex: number];

export class ProofreadTranscript {
  protected currentLine: number;
  protected currentWord: number;
  protected isBetween: boolean;
  protected lastEnd: number;

  //private hasChanged: boolean;
  protected transcript: TranscriptSchema;

  constructor() {
    //this.loaded();
    this.currentLine = 0;
    this.currentWord = 0;
    this.isBetween = true;
    this.lastEnd = 0;

    //this.hasChanged = false;
    this.transcript = { url: "", speakers: [], lines: [] };
  }

  logState() : void {
    console.log(`State: line=${this.currentLine}, word=${this.currentWord}, isBetween=${this.isBetween}, lastEnd=${this.lastEnd}`);
  }

  logWord(lineIndex: number, wordIndex: number) : void {
    const word: TranscriptWord = this.getWord(lineIndex, wordIndex);
    console.log(`Word: ${lineIndex}-${wordIndex} '${word.content}' colour=${this.getBackgroundColor(lineIndex, wordIndex)}`)
  }

  protected loaded() : void {
    this.currentLine = 0;
    this.currentWord = 0;
    this.isBetween = true;
    this.lastEnd = 0;
  }

  // Set the transcript by passing in a TranscriptSchema object.  Useful for testing.
  load(transcript: TranscriptSchema) : void {
    this.transcript = transcript;
    this.loaded();
  }

  getUrl() : string {
      return this.transcript.url;
  }

  // Get the name of the speaker of the given line
  getSpeakerName(lineIndex: number = this.currentLine) : string {
    let speakerName: string = '';
    if (lineIndex >= 0 && lineIndex < this.transcript.lines.length) {
      const speakerIndex = this.transcript.lines[ lineIndex ].speaker;
      if (speakerIndex >= 0 && speakerIndex < this.transcript.speakers.length) {
        speakerName = this.transcript.speakers[speakerIndex];
      }
    }
    return speakerName;
  }

  // Get the words of the current line
  getCurrentLineWords = () : Array<TranscriptWord> => {
    if (this.currentLine < this.transcript.lines.length) {
      return this.transcript.lines[this.currentLine].words;
    }
    else {
      return [];
    }
  }

  getWord(lineIndex: number, wordIndex: number) : TranscriptWord {
    if (lineIndex < this.transcript.lines.length) {
      let line = this.transcript.lines[lineIndex];
      if (wordIndex < line.words.length)
        return line.words[wordIndex];
    }
    return { confidence: 0, content: "", start_time: 0, end_time: 0 }
  }

  getPreviousWordIndex(lineWord: LineWord) : LineWord {
    let [ lineIndex, wordIndex ] = lineWord;
    // Is the previous word in the previous line?
    if (wordIndex == 0) {
      // On the first word
      if ( lineIndex > 0 ) {
        lineIndex--;
        wordIndex = this.transcript.lines[lineIndex].words.length-1;
      }
      // else - Already on the first word of the first line
    }
    else {
      wordIndex--;
    }
    return [ lineIndex, wordIndex ];
  }
  
  // Get the end time of the given word.
  getEndTime(lineWord: LineWord) : number {
    let [ lineIndex, wordIndex] = lineWord;
    let word: TranscriptWord;
    let isPrevious = false;
    do {
      if (isPrevious) {
        [ lineIndex, wordIndex ] = this.getPreviousWordIndex([ lineIndex, wordIndex ]);
      }
      isPrevious = true;
      word = this.getWord(lineIndex, wordIndex);
    } while (word.end_time === undefined);
    return word.end_time;
  }

  // Get the start time of the given word.
  getStartTime(lineWord: LineWord) : number {
    let [ lineIndex, wordIndex] = lineWord;
    let word: TranscriptWord;
    let isPrevious = false;
    do {
      if (isPrevious) {
        [ lineIndex, wordIndex ] = this.getPreviousWordIndex([ lineIndex, wordIndex ]);
      }
      isPrevious = true;
      word = this.getWord(lineIndex, wordIndex);
    } while (word.start_time === undefined);
    return word.start_time;
  }
  
  getNextWordIndex(lineWord: LineWord) : [ number, number ] {
    let [ lineIndex, wordIndex] = lineWord;
    // Is the next word in the next line?
    if (wordIndex >= this.transcript.lines[lineIndex].words.length-1) {
      // On the last word
      if ( this.currentLine < this.transcript.lines.length-1 ) {
        lineIndex++;
        wordIndex = 0;
      }
      // else - Already on the last word of the last line
    }
    else {
      wordIndex++;
    }
    return [ lineIndex, wordIndex ];
  }

  rewindToWord(line: TranscriptLine, wordIndex: number) : number {
    while (line.words[wordIndex].end_time === undefined && wordIndex > 0) {
      wordIndex--;
    }
    return wordIndex;
  }
  forwardToWord(line: TranscriptLine, wordIndex: number) : number {
    while (line.words[wordIndex].end_time === undefined && wordIndex < line.words.length) {
      wordIndex++;
    }
    return wordIndex;
  }

  lookupCurrentTime(time: number) : void {
    let lowIndex: number = 0;
    let highIndex: number = this.transcript.lines.length - 1;
    let middleIndex : number;
    let line: TranscriptLine | undefined;
    // let word: TranscriptWord;

    if (lowIndex > highIndex)
      return;
    
    // Find the line containing time
    while (lowIndex != highIndex) {
      middleIndex = Math.floor((lowIndex + highIndex) / 2);
      line = this.transcript.lines[middleIndex];
      let wordIndex = this.rewindToWord(line, line.words.length-1);
      if ( time > line.words[wordIndex].end_time ) {
        lowIndex = middleIndex + 1;
      }
      else {
        highIndex = middleIndex;
      }
    }
    this.currentLine = lowIndex;

    // Find the word containing time
    line = this.transcript.lines[this.currentLine];
    lowIndex = 0;
    highIndex = this.rewindToWord(line, line.words.length - 1);
    if (lowIndex > highIndex)
      return;

    while (lowIndex != highIndex) {
      middleIndex = this.rewindToWord(line, Math.floor((lowIndex + highIndex) / 2));;
      if ( time > line.words[middleIndex].end_time ) {
        lowIndex = this.forwardToWord(line, middleIndex + 1);
      }
      else {
        highIndex = middleIndex;
      }
    }
    this.currentWord = lowIndex;
    this.isBetween = time < line.words[lowIndex].start_time;
    //this.lastEnd = this.getPreviousEndTime(this.currentLine, this.currentWord);
    this.lastEnd = this.getEndTime(this.getPreviousWordIndex([this.currentLine, this.currentWord]));
  }

  // Set the current line/word etc for the given time
  // Returns true if it was necessary to do a full search
  setCurrentTime(time: number) : boolean {
    if ( time < this.lastEnd || time > (this.lastEnd + 10) ){
      //console.log("Time shifted to " + time);
      this.lookupCurrentTime(time);
      return true;
    }

    let word: TranscriptWord;
    let lineIndex: number = this.currentLine;
    let wordIndex: number = this.currentWord;
    let isFound: boolean = false;
    do {
        word = this.getWord(lineIndex, wordIndex);
        if ( word.end_time !== undefined ) {
          if ( time <= word.end_time ) {
            isFound = true;
            this.isBetween = time < word.start_time;
          }
        }

        if ( isFound ) {
          this.currentLine = lineIndex;
          this.currentWord = wordIndex;
        }
        else {
          if ( word.end_time !== undefined ) {
            this.lastEnd = word.end_time;
          }
          [lineIndex, wordIndex] = this.getNextWordIndex([lineIndex, wordIndex]);
        }
    } while (!isFound);
    return false;
  }

  isCurrent(lineIndex: number, wordIndex: number) {
    return lineIndex == this.currentLine && this.currentWord == wordIndex;
  }

  getBackgroundColor(lineIndex: number, wordIndex: number) : string {
    const word = this.getWord(lineIndex, wordIndex);
    return wordBackgroundColor(word, this.isCurrent(lineIndex, wordIndex));
  }
}

export class ProofreadDom extends ProofreadTranscript {
  private prefix: string;
  private isEdit: boolean;
  
  constructor() {
    super();
    this.prefix = "ic";
    this.isEdit = false;
  }

  reload() {
    this.loaded();
    this.updateLine();
    this.setEdit(false);

    // Set the transcript's audio url (if any) in the audio player (if any)
    const url: string = this.getUrl();
    if (url != '') {
      const audioElement = document.getElementById(this.prefix + "-audio") as HTMLAudioElement;
      if (audioElement) {
        audioElement.src = url;
      }
    }

    // Set the line select
    const selectElement: HTMLSelectElement | null = document.getElementById(this.prefix + "-select-line") as HTMLSelectElement;
    if ( selectElement ) {
      let html: string = "";
      for (let lineIndex = 0; lineIndex < this.transcript.lines.length; lineIndex++) {
        const offset: number = this.transcript.lines[lineIndex].words[0].start_time;
        html += `<option value="${offset}">${secondsToHms(offset)} ${htmlEncode(this.getSpeakerName(lineIndex))}</option>`;
      }
      selectElement.innerHTML = html;
    } 
  }

  // Set the transcript by passing in the URL of a transcript file or a TranscriptSchema object.
  async load(transcript: string | TranscriptSchema) {
    if ( typeof transcript === "string") {
      // Load from URL using the DOM
      const response = await window.fetch(transcript);
      this.transcript = await response.json();
    }
    else {
      // Load from TranscriptSchema object
      super.load(transcript);
    }
    this.reload();
  }
  
  // Setup a button's click event handler
  attachButton(id: string, eventHandler: EventHandler) : void {
    let element: HTMLElement | null = document.getElementById(this.prefix + id);
    if (element) {
      element.addEventListener("click", eventHandler);
    }    
  }

  attach(url: string | null, prefix: string = "ic") : void {
    this.prefix = prefix;
    let element: HTMLElement | null;

    const el = document.getElementById(prefix + "-transcript-url") as HTMLInputElement;
    if (el) {
        // There's a url field, so get/set the URL.
        if (url) {
            // Overwrite the default value with the parameter
            el.value = url;
        }
        else if (el.value) {
            // Use the default value
            url = el.value;
        }
    }
    
    // Load the audo first, so it can load asynchronously while the rest of the attaching happens
    element = document.getElementById(this.prefix + "-audio") as HTMLAudioElement;
    if ( element ) {
      element.addEventListener("timeupdate", this.handleTimeupdate);
      // Set url value, if provided
      if (url) {
        // Load the URL
        this.load(url);
      }
    }

    this.attachButton("-load-url", this.handleLoadUrlButtonClick);
    this.attachButton("-load-local", this.handleLoadLocalButtonClick);
    this.attachButton("-skip-to-offset", this.handleSkipButtonClick);
    this.attachButton("-prev-line", this.handleLineButton);
    this.attachButton("-next-line", this.handleLineButton);
    this.attachButton("-rw-btn", this.handeRwFfButton);
    this.attachButton("-ff-btn", this.handeRwFfButton);
    this.attachButton("-save", this.handleSaveButton);
    this.attachButton("-cancel", this.handleCancelButton);
    this.attachButton("-download", this.handleDownloadButton);
    this.attachButton("-load-file", this.handleUploadButton);

    this.setEdit(false);

    element = document.getElementById(this.prefix + "-upload-file");
    if (element) {
      element.addEventListener("change", this.handleUploadFile);
    }  

    // Set the select onchange handler
    element = document.getElementById(this.prefix + "-select-line");
    if (element) {
      element.addEventListener("change", this.handleSelectLine);
    }

    // Set the word click handler
    element = document.getElementById(this.prefix + "-line");
    if (element) {
      element.addEventListener("click", this.handleClickWord);
      element.addEventListener("dblclick", this.handleDoubleClickWord);
    }
  }

  // The current line has changed. Update the UI accordingly
  updateLine() : void {
    let container: HTMLElement | null;
    //this.logState();

    // Set the speaker name in the speaker element, if any
    container = document.getElementById(this.prefix + '-speaker') as HTMLHtmlElement;
    if (container) {
      container.innerText = this.getSpeakerName();
    }

    // Set the current line in the line element
    container = document.getElementById(this.prefix + '-line');
    if (container) {
      const words: Array<TranscriptWord> = this.getCurrentLineWords();
      let html: string = '';
      let backgroundColor: string;
      for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
        let word: TranscriptWord = words[wordIndex];
        //console.log(`${this.currentLine}-${wordIndex} '${word.content}' colour=${this.getBackgroundColor(this.currentLine, wordIndex)}`)
        backgroundColor = this.getBackgroundColor(this.currentLine, wordIndex);
        if (backgroundColor != "") {
          backgroundColor = ` style='background-color: ${backgroundColor}'`;
        }
        html += ( word.start_time !== undefined ? ' ' : '')
          + `<span id="${this.prefix}-word-${wordIndex}"${backgroundColor}>${htmlEncode(word.content)}</span>`
      }
      container.innerHTML = html;
    }

    const selectElement: HTMLSelectElement | null = document.getElementById(this.prefix + "-select-line") as HTMLSelectElement;
    if (selectElement) {  
      selectElement.selectedIndex = this.currentLine;
    }
  }

  handleLoadUrlButtonClick = async (event: Event) => {
    if (event.type === "click") {
      const el = document.getElementById(this.prefix + "-transcript-url") as HTMLInputElement;
      if (el) {
        await this.load(el.value);
      }
    }
  }

  handleLoadLocalButtonClick = async (event: Event) => {
    if (event.type === "click") {
      this.loadLocal();
      this.reload();
    }
  }

  setBackgroundColor(lineIndex: number, wordIndex: number) {
    const span = document.getElementById(this.prefix + "-word-" + String(wordIndex) ) as HTMLSpanElement;
    span.style.setProperty('background-color', this.getBackgroundColor(lineIndex, wordIndex), '');
  }

  setCurrentTime(currentTime : number) : boolean {
    const beforeMonlogueIndex = this.currentLine;
    const beforeWordIndex = this.currentWord;
    const beforeIssBetween = this.isBetween;

    //var timeAtStart = Date.now()
    const isSeek = super.setCurrentTime(currentTime);
    //var timeAfterSync = Date.now()

    if (beforeMonlogueIndex != this.currentLine ) {
      // The line has changed.
      // Update the displayed text.
      this.updateLine();
    }
    else if (beforeWordIndex != this.currentWord || beforeIssBetween != this.isBetween ) {
      // Moved to a different word in the same line.
      // Set the background colour
      this.setBackgroundColor(beforeMonlogueIndex, beforeWordIndex);
      this.setBackgroundColor(this.currentLine, this.currentWord);
    }
    //var timeAfterDom = Date.now()

    //if (isSeek) {
    //  console.log(`Sync took ${timeAfterSync-timeAtStart} and DOM took ${timeAfterDom-timeAtStart}`);
    //}
      
    return isSeek;
  }

  handleTimeupdate = async (event: Event) => {
    const audio = event.target as HTMLAudioElement;
    const currentTime: number = audio.currentTime;
    this.setCurrentTime(currentTime);
    if (this.isEdit) {
      // Going into edit mode.
      this.isEdit = false;
      const audioElement: HTMLAudioElement | null = document.getElementById(this.prefix + "-audio") as HTMLAudioElement;
      if (audioElement) {
        audioElement.pause();
      }

      // Load the curent word into the editor
      this.setEdit(true);
      const el = document.getElementById(this.prefix + "-edit-word") as HTMLInputElement;
      if (el) {
        el.value = this.transcript.lines[this.currentLine].words[this.currentWord].content;
        el.focus();
      }
    }
  }

  skipTo(offset: number) {
    offset = isNaN(offset) ? 0 : offset;
    //console.log(`Skip to ${offset}`)
    const audioElement: HTMLAudioElement | null = document.getElementById(this.prefix + "-audio") as HTMLAudioElement;
    if (audioElement) {
      audioElement.currentTime = offset;
    }
  }

  handleSkipButtonClick = (event: Event) : void => {
    if (event.type === "click") {
      const offsetInput: HTMLInputElement | null = document.getElementById(this.prefix + "-offset") as HTMLInputElement;
      this.skipTo(parseInt(offsetInput?.value));
    }
  }

  handleSelectLine = (event: Event) : void => {
    const optionElement = event.target as HTMLOptionElement;
    this.skipTo(parseInt(optionElement?.value));
    //console.log(optionElement?.value);
  }

  // Go to the previous/next line
  handleLineButton = (event: Event) : void => {
    const buttonElement:HTMLElement | null  = event.target as HTMLElement;

    const lineIndex = this.currentLine + (buttonElement.id == this.prefix + "-prev-line" ? -1 : +1);
    if (lineIndex >= 0 && lineIndex < this.transcript.lines.length) {
      const word: TranscriptWord = this.getWord(lineIndex, 0);
      //console.log(`to line ${lineIndex}, starting at ${word.start_time}`);
      
      // Get the start time of the line's first word
      //const time = this.transcript.lines[selectElement.selectedIndex + (buttonElement.id == this.prefix + "-prev-line" ? -1 : +1)].words[0].start_time;
      //selectElement.selectedIndex = lineIndex + offset;
      this.skipTo(word.start_time);
    }
  }

  // Rewind / fast-forward
  handeRwFfButton = (event: Event) : void => {
    const buttonElement:HTMLElement | null  = event.target as HTMLElement;
    const audioElement: HTMLAudioElement | null = document.getElementById(this.prefix + "-audio") as HTMLAudioElement;
    if (audioElement && buttonElement) {
      let seconds: number = parseInt(buttonElement.getAttribute("data-seconds") || '');
      //console.log(seconds);
      seconds = isNaN(seconds) ? (buttonElement.id == this.prefix + "-rw-btn" ? -5 : 15) : seconds;
      const time = audioElement.currentTime + seconds;
      this.skipTo(time);
    }
  }

  wordIdToWordIndex(wordId: string): number {
    return parseInt(wordId.substring(this.prefix.length + 6));
  }

  // Go to the clicked word
  handleClickWord = (event: Event) : void => {
    const element:HTMLElement | null = event.target as HTMLElement;
    let wordIndex = this.wordIdToWordIndex(element.id);
    if (isNaN(wordIndex)) {
      wordIndex = this.transcript.lines[this.currentLine].words.length -1;
    }

    this.skipTo( this.getStartTime([this.currentLine, wordIndex]));
  }

  handleDoubleClickWord = (event: Event) : void => {
    //event.preventDefault();
    this.isEdit = true;
    this.skipTo( this.getStartTime([this.currentLine, this.currentWord]));
  }

  setEdit(isEnable: boolean) {
    let elementInput: HTMLInputElement | null = document.getElementById(this.prefix + "-edit-word") as HTMLInputElement;
    if (elementInput) {
      elementInput.value = "";
      elementInput.disabled = !isEnable;
    }

    let elementButton: HTMLButtonElement | null;
    elementButton = document.getElementById(this.prefix + "-save") as HTMLButtonElement;
    if (elementButton) {
      elementButton.disabled = !isEnable;
    }
    elementButton = document.getElementById(this.prefix + "-cancel") as HTMLButtonElement;
    if (elementButton) {
      elementButton.disabled = !isEnable;
    }  
  }

  handleSaveButton = (event: Event) : void => {
    const el = document.getElementById(this.prefix + "-edit-word") as HTMLInputElement;
    const TranscriptWord = this.transcript.lines[this.currentLine].words[this.currentWord];
    TranscriptWord.content = el.value;
    TranscriptWord.confidence = 1;
    this.updateLine();
    this.saveLocal();
    this.setEdit(false);
  }

  handleCancelButton = (event: Event) : void => {
    this.setEdit(false);
  }

  saveLocal() {
    localStorage.setItem("transcript", JSON.stringify(this.transcript));
  }

  loadLocal() {
    const transcript: string | null = localStorage.getItem("transcript")
    if (transcript) {
      this.transcript = JSON.parse(transcript);
    }
  }

  handleUploadButton = (event: Event) : void => {
    const element:HTMLInputElement | null = document.getElementById(this.prefix + "-upload-file") as HTMLInputElement;
    if (element) {
      element.click();
    }
  }

  handleUploadFile = (event: Event) : void => {
    const element:HTMLInputElement | null = event.target as HTMLInputElement;
    if (element && element.files && element.files.length) {
      const reader = new FileReader();
      // Read the image as base64 data
      reader.onload = (e) => {
        if (e.target && e.target.result && typeof(e.target.result) == "string") {
          this.transcript = JSON.parse(e.target.result);
          this.reload();
        }
      }
      reader.readAsText(element.files[0]);
    }
  }

  handleDownloadButton = (event: Event) : void => {
    const blob = new Blob(
      [JSON.stringify(this.transcript)], 
      { type: 'text/json;charset=utf-8' }
    );
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = "transcript.json";
    anchor.click(); // Click the link to trigger the file download
    URL.revokeObjectURL(blobUrl);
  }
}

export class ProofreadFilesystem extends ProofreadTranscript {
  async load(transcript: string | TranscriptSchema) {
    if ( typeof transcript === "string") {
      
      this.transcript = JSON.parse(await fs.readFile(transcript, 'utf-8'));
      this.loaded();
    }
    else {
      super.load(transcript);
    }
  }    
}
