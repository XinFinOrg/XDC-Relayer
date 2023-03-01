/* eslint-disable quotes */
/* eslint-disable @typescript-eslint/no-var-requires */
const Web3 = require("web3");
const prompt = require("prompt");
const subnetContract = require("./subnet.json");

var mainnetUrl = "http://35.172.180.141:8545"; // To be replaced by any devnet node address
var smartContractAddress = "0x16da2C7caf46D0d7270d68e590A992A90DfcF7ee";

(async() => {
    var web3 = new Web3(mainnetUrl);
    var smartContractInstance = new web3.eth.Contract(subnetContract.abi, smartContractAddress);
    prompt.start();
    while (true) {
        console.log("Type 1: For fetch latest hash. 2: For get stored header details(encoded) by hash. 3: To check Confirmation status by hash");
        const { option } = await prompt.get(['option']);
        switch (option) {
            case "1":
                await fetchLatest(smartContractInstance);
                break;
            case "2":
                console.log("What's the hash?");
                const { hashToFetchHeader } = await prompt.get("hashToFetchHeader");
                await fetchHeaderByHash(smartContractInstance, hashToFetchHeader);
                break;
            case "3":
                console.log("What's the hash?");
                const { hashToConfirm } = await prompt.get("hashToConfirm");
                await confirmStatus(smartContractInstance, hashToConfirm);
                break;
            default:
                break;
        }
        console.info("--------------------JOB DONE-------------------");
    }
})();


const fetchLatest = async(smartContractInstance) => {
    var result = await smartContractInstance.methods.getLatestBlocks().call();
    var latestSmHash = result[0].hash;
    var latestSmHeight = result[0].number;

    console.log(`Latest subnet block hash stored in devnet smart contract is ${latestSmHash} at height of ${latestSmHeight}`);
    console.log(`Latest subnet block hash committed in devnet smart contract is ${result[1].hash} at height of ${result[1].number}`);
};

const fetchHeaderByHash = async(smartContractInstance, hashToFetchHeader) => {
    var header = await smartContractInstance.methods.getHeader(hashToFetchHeader).call();
    console.log(header);
};

const confirmStatus = async(smartContractInstance, hashToConfirm) => {
    var status = await smartContractInstance.methods.getHeaderConfirmationStatus(hashToConfirm).call();
    console.log(`Status for this hash is ${status}`);
};