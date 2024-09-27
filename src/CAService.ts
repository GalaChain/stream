import { Identity as BaseIdentity, Wallet, Wallets } from "fabric-network";
import FabricCAServices from "fabric-ca-client";
import fs from "fs";

export interface UserConfig {
  userId: string;
  userSecret: string;
}

export interface CAConfig {
  url: string;
  name: string;
  orgMsp: string;
  tlsCert?: string;
  tlsCertPath?: string;
}

export interface IIdentity extends BaseIdentity {
  credentials: {
    certificate: string;
    privateKey: string;
  };
  version: number;
}

export class CAService {
  private readonly walletPromise: Promise<Wallet>;
  private readonly caClient: FabricCAServices;

  constructor(
    private readonly caConfig: CAConfig,
    private readonly userConfig: UserConfig
  ) {
    const caTLSCACerts = caConfig?.tlsCert ?? (caConfig?.tlsCertPath ? fs.readFileSync(caConfig.tlsCertPath).toString("utf-8") : undefined);
    const tlsConfig = caTLSCACerts ? { trustedRoots: [caTLSCACerts], verify: false } : undefined;
    this.caClient = new FabricCAServices(caConfig.url, tlsConfig, caConfig.name);
    this.walletPromise = Wallets.newInMemoryWallet();
  }

  public async getWallet(): Promise<Wallet> {
    return this.walletPromise;
  }

  public async getIdentity(): Promise<IIdentity> {
    const wallet = await this.walletPromise;

    const identity = await wallet.get(this.userConfig.userId);
    if (!!identity) {
      return identity as IIdentity;
    }

    const enrollment = await this.caClient.enroll({
      enrollmentID: this.userConfig.userId,
      enrollmentSecret: this.userConfig.userSecret
    });

    return {
      credentials: {
        certificate: enrollment.certificate,
        privateKey: enrollment.key.toBytes()
      },
      mspId: this.caConfig.orgMsp,
      type: "X.509",
      version: 1
    };
  }
}
