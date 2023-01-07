import { SubnetClient } from "./../service/subnet";
import { MainnetClient } from "./../service/mainnet";
import { CronJob } from "cron";
import { config } from "../config";


export class Worker {
  private cron: CronJob;
  private abnormalDetectionCronJob: CronJob;
  private mainnetClient: MainnetClient;
  private subnetClient: SubnetClient;

  constructor(onAbnormalDetected: () => void) {
    this.mainnetClient = new MainnetClient({} as any);
    this.subnetClient = new SubnetClient({} as any);
    this.cron = new CronJob(config.cronJobExpression, async () => {
      console.log("⏰ Executing normal flow periodically");
      // Pull subnet's latest confirmed block
      const latestConfirmedSubnetBlock = await this.subnetClient.getLastConfirmedBlock();
      const lastSubmittedSubnetBlock = await this.subnetClient.getLastSubmittedBlock();
      const txs = await this.getDiffingTransactions(latestConfirmedSubnetBlock, lastSubmittedSubnetBlock);
      await this.mainnetClient.submitTransactions(txs);
      await this.subnetClient.cachingLastSubmittedBlock(latestConfirmedSubnetBlock);
    });
    
    this.abnormalDetectionCronJob = new CronJob(config.abnormalDetectionCronJobExpression, () => {
      console.log("🏥 Executing abnormal Detection periodically");
      // Trigger the callback to initiatiate the bootstrap in event bus again
      onAbnormalDetected();
    });
  }

  async bootstrap(): Promise<void> {
    // Clean timers
    this.cron.stop();
    this.abnormalDetectionCronJob.stop();

    // Pull latest confirmed tx from mainnet
    const lastAuditedBlock = await this.mainnetClient.getLastAuditedBlock();
    // Pull latest confirm block from subnet
    const latestConfirmedSubnetBlock = await this.subnetClient.getLastConfirmedBlock();
    // Diffing
    const txs = await this.getDiffingTransactions(lastAuditedBlock, latestConfirmedSubnetBlock);
    // Submit new txs
    await this.mainnetClient.submitTransactions(txs);
    // Store subnet block into cache
    await this.subnetClient.cachingLastSubmittedBlock(latestConfirmedSubnetBlock);
  }
  
  async synchronization(): Promise<void> {
    console.log("Start the synchronization to audit the subnet block by submit smart contract transaction onto XDC's mainnet");
    this.cron.start();
    this.abnormalDetectionCronJob.start();
  }
  
  
  async getDiffingTransactions(higherOrderBlocl: any, lowerOrderBlock: any): Promise<any> {
    console.log("Doing the two block diffing logic and returning transactions that is ready to be submitted to mainnet");
  }
}