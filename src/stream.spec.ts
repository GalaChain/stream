import stream from "./stream";
import { Block } from "./types";
import { ConnectedStream } from "./ConnectedStream";

jest.setTimeout(60 * 1000)

let connectedStream: ConnectedStream;

beforeAll(() => {
  connectedStream = stream.connect().channel("product-channel");
});

afterAll(() => {
  connectedStream.disconnect();
});

it("should stream blocks", async () => {
  // Given
  const fetchedBlocks: Block[] = [];

  // When
  connectedStream
    .fromBlock(25)
    .subscribe({
      next: (block) => fetchedBlocks.push(block),
      error: (err) => console.error("Error:", err),
      complete: () => console.log("Stream completed")
    });

  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Then
  const numbers = fetchedBlocks.slice(0, 10).map(b => b.blockNumber);
  expect(numbers).toEqual([25, 26, 27, 28, 29, 30, 31, 32, 33, 34]);
});
