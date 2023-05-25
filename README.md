# XDC Relayer

Relayer is a communication bridge between XDC parent chain and its subnet. It provides synchronisation feature to make sure subnet chain is audited on parent chain securely.

## Pre-reqs
To build and run this app locally you will need:
- Install [Node.js](https://nodejs.org/en/). Note, we use node 14

# Getting Started
- Install dependencies
```
npm install
```
- Set up .env
Copy over the .example.env file and override the values to appropriate ones
The new file name shall be `.env`

- Run the project directly in TS (dev mode)
```
npm run start:dev
```

- Build and run the project in JS
```
npm run build
npm run start
```

- Run unit tests
```
npm run test
```

- Run unit tests with coverage 
```
npm run test:coverage
```

- Run unit tests on Jest watch mode
```
npm run test:watch
```

## Environment variables
Create a .env file (or just rename the .example.env) containing all the env variables you want to set, dotenv library will take care of setting them. This project is using three variables at the moment:

 * PORT -> port where the server will be started on
 * NODE_ENV -> environment, development value will set the logger as debug level, also important for CI.
 
### Find the value for important envs
1. `SUBNET_URL` : This is the URL to your subnet with RPC port specified. e.g http://66.94.121.151:8545
2. `PARENTCHAIN_URL` : This is the XDC parent chain URL with RPC port specified.
3. `SC_ADDRESS` : This is the smart contract address for this subnet that has been uploaded in the parent chain.
4. `PARENTCHAIN_WALLET_PK` : This is the wallet key that will be used for submit subnet data into parent chain. You will need to have credits in it first.
5. `SLACK_WEBHOOK` : (Optional) If relayer detected forking of your subnet, this is the URL where we will push alerting message to. You are required to set up slack bot and install it in the relevant channel first. For details, see slack doc: https://api.slack.com/messaging/webhooks \n
Once you are done with the slack setup, find the slack webhook url and put it here. It shall look like `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX`  We only need the ones after `https://hooks.slack.com/services/`

## Getting TypeScript
TypeScript itself is simple to add to any project with `npm`.
```
npm install -D typescript
```
If you're using VS Code then you're good to go!
VS Code will detect and use the TypeScript version you have installed in your `node_modules` folder. 
For other editors, make sure you have the corresponding [TypeScript plugin](http://www.typescriptlang.org/index.html#download-links). 

## Configuring TypeScript compilation
TypeScript uses the file `tsconfig.json` to adjust project compile options.
Let's dissect this project's `tsconfig.json`, starting with the `compilerOptions` which details how your project is compiled. 

```json
    "compilerOptions": {
        "module": "commonjs",
        "target": "es2017",
        "lib": ["es6"],
        "noImplicitAny": true,
        "strictPropertyInitialization": false,
        "moduleResolution": "node",
        "sourceMap": true,
        "outDir": "dist",
        "baseUrl": ".",
        "experimentalDecorators": true,
        "emitDecoratorMetadata": true,  
        }
    },
```

## Running ESLint
Like the rest of our build steps, we use npm scripts to invoke ESLint.
To run ESLint you can call the main build script or just the ESLint task.
```
npm run build   // runs full build including ESLint format check
npm run lint    // runs ESLint check + fix
```
Notice that ESLint is not a part of the main watch task.
It can be annoying for ESLint to clutter the output window while in the middle of writing a function, so I elected to only run it only during the full build.
If you are interested in seeing ESLint feedback as soon as possible, I strongly recommend the [ESLint extension in VS Code](https://github.com/Microsoft/vscode-eslint.git).
