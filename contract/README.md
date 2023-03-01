To run demo on MAINNET, follow below:
1. At root of this repo (not here, one level up. run `cd ..`), run `nvm use` and install the correct node version
2. Run `npm install`
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