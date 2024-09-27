import { Block, RangeRead, Read, Transaction, TransactionValidationCode, Write } from "./types";
import { X509Certificate } from "crypto";
import { sha256 } from "js-sha256";

export interface RWSet {
  namespace: string;
  rwset: {
    reads: Array<{
      key: string;
    }>;
    writes: Array<{
      is_delete: boolean;
      key: string;
      value: Record<string, unknown>;
    }>;
    range_queries_info: Array<{
      start_key: string;
      end_key: string;
      reads_merkle_hashes: { max_level_hashes: Buffer[] };
    }>
  };
}

export function parseOrString(s: string): Record<string, unknown> | string {
  try {
    return JSON.parse(s);
  } catch (e) {
    return s;
  }
}

export function parseBlock(block: any): Block {
  try {
    const rawTransactions = block.data.data;
    const firstTransactionHeader = rawTransactions[0].payload.header;

    const blockNumber = block.header.number.toNumber();
    const channelName = firstTransactionHeader.channel_header.channel_id;
    const createdAt = new Date(firstTransactionHeader.channel_header.timestamp);

    const transactions: Array<Transaction> = [];

    for (const rawTransaction of rawTransactions) {
      const transactionHeader = rawTransaction.payload.header;

      let txId = transactionHeader.channel_header.tx_id;
      const timestamp = transactionHeader.channel_header.timestamp;
      if (!txId) continue;

      const transactionType = transactionHeader.channel_header.typeString;
      const creatorMspId = transactionHeader.signature_header.creator.mspid;
      const cert = new X509Certificate(transactionHeader.signature_header.creator.id_bytes);

      // Match the expected OU/CN pattern, does not match fully formed X509Certificate subject present on Genesis blocks
      const subjectMatch = cert.subject.match(/OU=(\w+).*CN=(\w+)/s);
      const creatorName = subjectMatch ? (subjectMatch[1] ?? "") + "|" + (subjectMatch[2] ?? "") : "|";

      let chaincodeRWSets: Array<RWSet>;

      if (transactionType === "ENDORSER_TRANSACTION") {
        if (!rawTransaction.payload.data.actions) continue;

        const action = rawTransaction.payload.data.actions[0];

        const endorserMsps = (action.payload.action.endorsements ?? []).map((e) => e.endorser.mspid);

        const args = action.payload.chaincode_proposal_payload.input.chaincode_spec.input.args.map((a) =>
          a.toString()
        );

        const chaincode = {
          name: action.payload.action.proposal_response_payload.extension.chaincode_id.name,
          version: action.payload.action.proposal_response_payload.extension.chaincode_id.version
        };

        const allRWSets = action.payload.action.proposal_response_payload.extension.results.ns_rwset;
        chaincodeRWSets = allRWSets.filter(({ namespace }) => namespace === chaincode.name) as Array<RWSet>;

        if (transactionType === "CONFIG") {
          txId = sha256(JSON.stringify(rawTransaction));
        }

        const setsAccumulator: { reads: Read[]; writes: Write[], rangeReads: RangeRead[] } = {
          reads: [],
          writes: [],
          rangeReads: []
        };

        const sets = chaincodeRWSets.reduce((acc, set) => {
          const { reads, writes, range_queries_info } = set.rwset;

          const parsedReads = reads.map((read) => ({
            key: read.key.replace("\0", "/")
          }));
          acc.reads.push(...parsedReads);

          const rangeReads = range_queries_info.map((range) => ({
            startKey: range.start_key.replace("\0", "/"),
            endKey: range.end_key.replace("\0", "/")
          }));
          acc.rangeReads.push(...rangeReads);

          const parsedWrites = writes.map((write) => {
            return {
              isDelete: write.is_delete,
              key: write.key.replace("\0", "/"),
              value: parseOrString(write.value.toString()) // chain objects
            };
          });
          acc.writes.push(...parsedWrites);

          return acc;
        }, setsAccumulator);

        const chaincodeResponse = action.payload.action.proposal_response_payload.extension.response;
        chaincodeResponse.payload = parseOrString(chaincodeResponse.payload.toString());

        transactions.push({
          id: txId,
          timestamp: timestamp,
          creator: {
            mspId: creatorMspId,
            name: creatorName
          },
          type: transactionType,
          validationCode: TransactionValidationCode.UNKNOWN,
          chaincode,
          chaincodeResponse,
          reads: sets.reads,
          writes: sets.writes,
          rangeReads: sets.rangeReads,
          endorserMsps,
          method: args[0],
          parameters: args.slice(1)
        });
      }
    }
    return {
      blockNumber,
      channelName,
      transactions,
      createdAt
    };
  } catch (err) {
    throw err;
  }
}