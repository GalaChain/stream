import { ConnectedStream } from "./ConnectedStream";
import { ConnectionParams, StreamBuilder } from "./StreamBuilder";

const stream = {
  connect(config?: ConnectionParams): { channel(name: string): ConnectedStream } {
    const builder = new StreamBuilder(config ?? {});

    return {
      channel: (name: string) => builder.build(name)
    };
  }
};

export default stream;
