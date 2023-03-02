To run demo on MAINNET, follow below:
1. At root of this repo (not here, one level up. run `cd ..`), run `nvm use` and install the correct node version
2. Run `npm install`
3. Go to http://devnet.apothem.network/#stats copy one of the devnet running node IP address.
  - You shoudl be able to see a bunch of nodes with name similar to this `xdc118-67ec4816d65b9f43d6e8371e1a9cdc0bf891e468-18.207.125.79`. Copy the last few numbers such as `18.207.125.79` in this case.
4. Open the file of `contract/index.js`, update the IP address for mainnet node
  - Find the line of code such as `var mainnetUrl = "http://{{IP_ADDRESS_HERE}}:8545"; // To be replaced by any devnet node address` and replace the `{{IP_ADDRESS_HERE}}` with the IP address from step 3.
3. Run `node contract/index.js`

To check the block in SUBNET, run below in your terminal:
1. Get block by hash:
```
curl --request POST \
  --url http://66.94.121.151:8545/getBlockByHash \
  --header 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_getBlockByHash","params":["XXXXXXXXX", true],"id":1}'
```
Make sure you replace the block hash for the `XXXXXXX`

2. Get Block by number:
```
curl --request POST \
  --url http://66.94.121.151:8545/getBlockByNumber \
  --header 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["0x123",true],"id":1}'
```
Make sure you replace the block height in hex for the `0x123`