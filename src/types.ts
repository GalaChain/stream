export interface ChainInfo {
  channelName: string;
  height: number;
}

export interface Block {
  blockNumber: number;
  channelName: string;
  transactions: Transaction[];
  createdAt: Date;
}

// Direct mapping of fabric status codes
// https://github.com/hyperledger/fabric-protos-go/blob/main/peer/transaction.pb.go
export enum TransactionValidationCode {
  VALID = 0,
  NIL_ENVELOPE = 1,
  BAD_PAYLOAD = 2,
  BAD_COMMON_HEADER = 3,
  BAD_CREATOR_SIGNATURE = 4,
  INVALID_ENDORSER_TRANSACTION = 5,
  INVALID_CONFIG_TRANSACTION = 6,
  UNSUPPORTED_TX_PAYLOAD = 7,
  BAD_PROPOSAL_TXID = 8,
  DUPLICATE_TXID = 9,
  ENDORSEMENT_POLICY_FAILURE = 10,
  MVCC_READ_CONFLICT = 11,
  PHANTOM_READ_CONFLICT = 12,
  UNKNOWN_TX_TYPE = 13,
  TARGET_CHAIN_NOT_FOUND = 14,
  MARSHAL_TX_ERROR = 15,
  NIL_TXACTION = 16,
  EXPIRED_CHAINCODE = 17,
  CHAINCODE_VERSION_CONFLICT = 18,
  BAD_HEADER_EXTENSION = 19,
  BAD_CHANNEL_HEADER = 20,
  BAD_RESPONSE_PAYLOAD = 21,
  BAD_RWSET = 22,
  ILLEGAL_WRITESET = 23,
  INVALID_WRITESET = 24,
  INVALID_CHAINCODE = 25,
  NOT_VALIDATED = 254,
  INVALID_OTHER_REASON = 255,

  // additional, our own value to indicate we didn't fetch it
  UNKNOWN = 999
}

export interface Transaction<ChainObject = unknown, ChaincodeResponse = unknown> {
  type: "ENDORSER_TRANSACTION";
  validationCode: TransactionValidationCode;
  creator: {
    mspId: string;
    name: string;
  };
  chaincode: {
    name: string;
    version: string;
  };
  chaincodeResponse: {
    status: number;
    payload: ChaincodeResponse;
  };
  reads: Read[];
  rangeReads: RangeRead[];
  writes: Write<ChainObject>[];
  id: string;
  timestamp: string;
  endorserMsps: string[];
  method: string;
  parameters: string[];
}

export interface Read {
  key: string;
}

export interface RangeRead {
  startKey: string;
  endKey: string;
}

export interface Write<ChainObject = unknown> {
  isDelete: boolean;
  key: string;
  value: ChainObject;
}
