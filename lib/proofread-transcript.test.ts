// sum.test.js
import { expect, test } from 'vitest';
import { ProofreadTranscript, TranscriptSchema } from './proofread-transcript';

const testTranscript: TranscriptSchema = {
    url: "",
    speakers: ["Robin", "Charlie"],
    monologues: [
      {
        speaker: 0,
        items: [
          {
            type: "pronunciation",
            alternatives: [{
              confidence: 99,
              content: "Hello"
            }],
            start_time: 0.5,
            end_time: 1
          },
          {
            type: "pronunciation",
            alternatives: [{
              confidence: 99,
              content: "there"
            }],
            start_time: 1.5,
            end_time: 2
          },
          {
            type: "punctuation",
            alternatives: [{
              confidence: 99,
              content: "."
            }],
            start_time: 0,
            end_time: 0
          }
        ]
      }
    ]
  }

class ProofreadTest extends ProofreadTranscript {
    showState() {
        console.log("line=" + String(this.currentSection) + ", word=" + String(this.currentWord) + ", isBetween=" + String(this.isBetween));
    }
    testState(lineIndex: number, wordIndex: number, isBetween: boolean): boolean {
        const isMatch: boolean = this.currentSection == lineIndex
        && this.currentWord == wordIndex
        && this.isBetween == isBetween;
        if (!isMatch) {
            this.showState();
        }
        return isMatch;
    }
}

test('Initial state', () => {
    const proofreadTest = new ProofreadTest();
    // After construction, there's an empty transcript
    expect(proofreadTest.testState(0,0,true)).toBe(true);

    proofreadTest.load( testTranscript );
    // After loading, position is in the space before the first word
    expect(proofreadTest.testState(0,0,true)).toBe(true);

    // n seconds < between last and word n <= n+0.5 is on word n <= n+1
    // n+0.5 to n+0.5 is the space between the last word and word n
    proofreadTest.setCurrentTime(0.25);
    expect(proofreadTest.testState(0,0,true)).toBe(true);

    proofreadTest.setCurrentTime(0.5);
    expect(proofreadTest.testState(0,0,false)).toBe(true);

    proofreadTest.setCurrentTime(0.75);
    expect(proofreadTest.testState(0,0,false)).toBe(true);

    proofreadTest.setCurrentTime(1);
    expect(proofreadTest.testState(0,0,false)).toBe(true);

    proofreadTest.setCurrentTime(1.001);
    expect(proofreadTest.testState(0,1,true)).toBe(true);

    proofreadTest.setCurrentTime(1.499);
    expect(proofreadTest.testState(0,1,true)).toBe(true);

    proofreadTest.setCurrentTime(1.5);
    expect(proofreadTest.testState(0,1,false)).toBe(true);
})