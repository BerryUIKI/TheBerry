import { describe, expect, it } from "vitest";
import { parseDelimitedRows } from "../utils/delimitedText";

describe("delimited file previews", () => {
  it("preserves quoted commas, escaped quotes, and whitespace", () => {
    expect(parseDelimitedRows('Alice,"1 Road, City","a ""quote""",  spaced  '))
      .toEqual([["Alice", "1 Road, City", 'a "quote"', "  spaced  "]]);
  });
  it("preserves multiline fields and handles CRLF record separators", () => {
    expect(parseDelimitedRows('name,note\r\nAlice,"one\r\ntwo"\r\nBob,end\r\n'))
      .toEqual([["name", "note"], ["Alice", "one\r\ntwo"], ["Bob", "end"]]);
  });
  it("parses TSV including quoted tabs", () => {
    expect(parseDelimitedRows('name\tvalue\nAlice\t"one\ttwo"', "\t"))
      .toEqual([["name", "value"], ["Alice", "one\ttwo"]]);
  });
  it("retains empty cells and skips empty physical lines", () => {
    expect(parseDelimitedRows('\uFEFFa,,\n\n"",b,c\n'))
      .toEqual([["a", "", ""], ["", "b", "c"]]);
  });
  it("bounds logical rows rather than physical lines", () => {
    expect(parseDelimitedRows('"one\ntwo",x\nsecond,y\nthird,z', ",", 2))
      .toEqual([["one\ntwo", "x"], ["second", "y"]]);
  });
});
