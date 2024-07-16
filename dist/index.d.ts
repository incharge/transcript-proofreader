import { TranscriptSchema, TranscriptLine, TranscriptWord } from '@incharge/transcript-core';

type EventHandler = (event: Event) => void;
type LineWord = [lineIndex: number, wordIndex: number];
export declare class ProofreadTranscript {
    protected currentLine: number;
    protected currentWord: number;
    protected isBetween: boolean;
    protected lastEnd: number;
    protected transcript: TranscriptSchema;
    constructor();
    logState(): void;
    logWord(lineIndex: number, wordIndex: number): void;
    protected loaded(): void;
    load(transcript: TranscriptSchema): void;
    getUrl(): string;
    getSpeakerName(lineIndex?: number): string;
    getCurrentLineWords: () => Array<TranscriptWord>;
    getWord(lineIndex: number, wordIndex: number): TranscriptWord;
    getPreviousWordIndex(lineWord: LineWord): LineWord;
    getEndTime(lineWord: LineWord): number;
    getStartTime(lineWord: LineWord): number;
    getNextWordIndex(lineWord: LineWord): [number, number];
    rewindToWord(line: TranscriptLine, wordIndex: number): number;
    forwardToWord(line: TranscriptLine, wordIndex: number): number;
    lookupCurrentTime(time: number): void;
    setCurrentTime(time: number): boolean;
    isCurrent(lineIndex: number, wordIndex: number): boolean;
    getBackgroundColor(lineIndex: number, wordIndex: number): string;
}
export declare class ProofreadDom extends ProofreadTranscript {
    private prefix;
    private isEdit;
    constructor();
    reload(): void;
    load(transcript: string | TranscriptSchema): Promise<void>;
    attachButton(id: string, eventHandler: EventHandler): void;
    attach(url: string | null, prefix?: string): void;
    updateLine(): void;
    handleLoadUrlButtonClick: (event: Event) => Promise<void>;
    handleLoadLocalButtonClick: (event: Event) => Promise<void>;
    setBackgroundColor(lineIndex: number, wordIndex: number): void;
    setCurrentTime(currentTime: number): boolean;
    handleTimeupdate: (event: Event) => Promise<void>;
    skipTo(offset: number): void;
    handleSkipButtonClick: (event: Event) => void;
    handleSelectLine: (event: Event) => void;
    handleLineButton: (event: Event) => void;
    handeRwFfButton: (event: Event) => void;
    wordIdToWordIndex(wordId: string): number;
    handleClickWord: (event: Event) => void;
    handleDoubleClickWord: (event: Event) => void;
    setEdit(isEnable: boolean): void;
    handleSaveButton: (event: Event) => void;
    handleCancelButton: (event: Event) => void;
    saveLocal(): void;
    loadLocal(): void;
    handleUploadButton: (event: Event) => void;
    handleUploadFile: (event: Event) => void;
    handleDownloadButton: (event: Event) => void;
}
export declare class ProofreadFilesystem extends ProofreadTranscript {
    load(transcript: string | TranscriptSchema): Promise<void>;
}
export {};
