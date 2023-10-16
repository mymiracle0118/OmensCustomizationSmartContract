import {
  Connection,
  Keypair,
  Signer,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionSignature,
  ConfirmOptions,
  sendAndConfirmRawTransaction,
  sendAndConfirmTransaction,
  RpcResponseAndContext,
  SimulatedTransactionResponse,
  Commitment,
  LAMPORTS_PER_SOL,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
  clusterApiUrl
} from "@solana/web3.js"
import * as bs58 from 'bs58'
import fs from 'fs'
import * as anchor from '@project-serum/anchor'
import {AccountLayout,MintLayout,TOKEN_PROGRAM_ID,Token,ASSOCIATED_TOKEN_PROGRAM_ID} from "@solana/spl-token";
import { program } from 'commander';
import { programs } from '@metaplex/js';
import log from 'loglevel';
import axios from "axios"
import { publicKey } from "@project-serum/anchor/dist/cjs/utils";

program.version('0.0.1');
log.setLevel('info');

// const programId = new PublicKey('AirdfxxqajyegRGW1RpY5JfPyYiZ2Z9WYAZxmhKzxoKo')
const programId = new PublicKey('5NDZfncNd9kdU2MHQFzsJqwaGYehWJBtcavnyvHus832')
const receiver = new PublicKey("6FU4xjEX6rY9PJMJxaNUeAh6yB4TUrPEM6BGhviE2yBE")
const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
const pool_address = new PublicKey('5HnUhBok3zeCVbNRzZhEFQifrt7sPoHQtAXKtNg5ny1C')
const idl=JSON.parse(fs.readFileSync('src/solana_anchor.json','utf8'))
const { metadata: { Metadata } } = programs

const confirmOption : ConfirmOptions = {
    commitment : 'finalized',
    preflightCommitment : 'finalized',
    skipPreflight : false
}

const sleep = (ms : number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

function loadWalletKey(keypair : any): Keypair {
  if (!keypair || keypair == '') {
    throw new Error('Keypair is required!');
  }
  const loaded = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(keypair).toString())),
  );
  log.info(`wallet public key: ${loaded.publicKey}`);
  // console.log("wallet", bs58.encode(loaded.secretKey))
  return loaded;
}

function loadKeyfromSecretKey(key : any): Keypair {
  // console.log(key);
  const loaded = Keypair.fromSecretKey(bs58.decode(key));
  console.log(`wallet public key: ${loaded.publicKey}`);
  return loaded;
}

const getTokenWallet = async (
  wallet: anchor.web3.PublicKey,
  mint: anchor.web3.PublicKey
    ) => {
  return (
    await anchor.web3.PublicKey.findProgramAddress(
      [wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  )[0];
}

const getMetadata = async (
  mint: anchor.web3.PublicKey
    ): Promise<anchor.web3.PublicKey> => {
  return (
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )
  )[0];
};

const createAssociatedTokenAccountInstruction = (
  associatedTokenAddress: PublicKey,
  payer: PublicKey,
  walletAddress: PublicKey,
  splTokenMintAddress: PublicKey
    ) => {
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
    { pubkey: walletAddress, isSigner: false, isWritable: false },
    { pubkey: splTokenMintAddress, isSigner: false, isWritable: false },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  return new TransactionInstruction({
    keys,
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.from([]),
  });
}

async function getDecimalsOfToken(conn : Connection, mint : PublicKey){
  let resp = await conn.getAccountInfo(mint)
  let accountData = MintLayout.decode(Buffer.from(resp!.data))
  return accountData.decimals
}

programCommand('initstate')
  .requiredOption(
    '-k, --keypair <path>',
    'Solana wallet location'
  )
  .action(async (directory,cmd)=>{
    try{
    const {env,keypair,info} = cmd.opts()
    const conn = new Connection(clusterApiUrl(env))
    const owner = loadWalletKey(keypair)
    const wallet = new anchor.Wallet(owner)
    const provider = new anchor.Provider(conn,wallet,confirmOption)
    const program = new anchor.Program(idl,programId,provider)
    const [state, bump] = await PublicKey.findProgramAddress([owner.publicKey.toBuffer(), pool_address.toBuffer()],programId)
    let transaction = new Transaction()
    
    // const decimals = Math.pow(10,await getDecimalsOfToken(conn,tokenMint))
    // console.log("token decimal", decimals);
    transaction.add(program.instruction.initState(
      new anchor.BN(bump),
      {
        accounts:{
          owner : owner.publicKey,
          pool : pool_address,
          state : state,
          systemProgram : SystemProgram.programId
        }
      }
    ))
    const hash = await sendAndConfirmTransaction(conn, transaction, [owner], confirmOption)
    console.log("state : "+state.toBase58())
    console.log("Transaction ID : " + hash)
    }catch(err){
      console.log(err)
    }
  })

  programCommand('init_pool')
  .requiredOption(
    '-k, --keypair <path>',
    'Solana wallet location'
  )
  .requiredOption(
    '-i, --info <path>',
    'Schedule info location'
  )
  .action(async (directory,cmd)=>{
    try{
    const {env,keypair,info} = cmd.opts()
    const conn = new Connection(clusterApiUrl(env))
    const owner = loadWalletKey(keypair)
    const wallet = new anchor.Wallet(owner)
    const provider = new anchor.Provider(conn,wallet,confirmOption)
    const program = new anchor.Program(idl,programId,provider)
    const rand = Keypair.generate().publicKey;
    const [pool, bump] = await PublicKey.findProgramAddress([rand.toBuffer()],programId)
    let transaction = new Transaction()
    const infoJson = JSON.parse(fs.readFileSync(info).toString())
    const tokenMint = new PublicKey(infoJson.token)
    const tokenAccount = await getTokenWallet(pool, tokenMint)

    if((await conn.getAccountInfo(tokenAccount)) == null) {
      transaction.add(createAssociatedTokenAccountInstruction(tokenAccount, owner.publicKey, pool, tokenMint))
    }

    console.log("trait price", infoJson.trait_price, infoJson.fit_price)
    
    // const decimals = Math.pow(10,await getDecimalsOfToken(conn,tokenMint))
    // console.log("token decimal", decimals);
    transaction.add(program.instruction.initPool(
      new anchor.BN(bump),
      new anchor.BN(infoJson.trait_price),
      new anchor.BN(infoJson.fit_price),
      {
        accounts:{
          payer : owner.publicKey,
          receiver : receiver,
          pool : pool,
          rand : rand,
          tokenMint : tokenMint,
          tokenProgram : TOKEN_PROGRAM_ID,
          systemProgram : SystemProgram.programId
        }
      }
    ))
    const hash = await sendAndConfirmTransaction(conn, transaction, [owner], confirmOption)
    console.log("POOL : "+pool.toBase58())
    console.log("Transaction ID : " + hash)
    }catch(err){
      console.log(err)
    }
  })

  programCommand('buytrait')
  .requiredOption(
    '-k, --keypair <path>',
    'Solana wallet location'
  )
  .requiredOption(
    '-i, --info <path>',
    'Schedule info location'
  )
  .action(async (directory,cmd)=>{
    try{
    const {env,keypair,info} = cmd.opts()
    const conn = new Connection(clusterApiUrl(env))
    const owner = loadWalletKey(keypair)
    const wallet = new anchor.Wallet(owner)
    const provider = new anchor.Provider(conn,wallet,confirmOption)
    const program = new anchor.Program(idl,programId,provider)
    const rand = Keypair.generate().publicKey;
    const [state, bump] = await PublicKey.findProgramAddress([owner.publicKey.toBuffer(), pool_address.toBuffer()],programId)
    let transaction = new Transaction()
    const infoJson = JSON.parse(fs.readFileSync(info).toString())
    const tokenMint = new PublicKey(infoJson.token)

    const balance : any = await conn.getBalance(owner.publicKey);

    console.log("balance", balance);

    const srcTokenAccount = await getTokenWallet(owner.publicKey, tokenMint)
    const destTokenAccount = await getTokenWallet(pool_address, tokenMint)

    // console.log("account", srcTokenAccount.toBase58(), destTokenAccount.toBase58())
    
    if((await conn.getAccountInfo(srcTokenAccount)) == null) {
      transaction.add(createAssociatedTokenAccountInstruction(srcTokenAccount, owner.publicKey, owner.publicKey, tokenMint))
    }

    if((await conn.getAccountInfo(destTokenAccount)) == null) {
      transaction.add(createAssociatedTokenAccountInstruction(destTokenAccount, owner.publicKey, pool_address, tokenMint))
    }
    
    const decimals = Math.pow(10,await getDecimalsOfToken(conn,tokenMint))
    console.log("token decimal", decimals);
    transaction.add(program.instruction.buyTrait(
      "Background",
      "bg1",
      new anchor.BN(1000000000),
      new anchor.BN(500000000),
      {
        accounts:{
          owner : owner.publicKey,
          pool : pool_address,
          state : state,
          tokenMint : tokenMint,
          srcTokenAccount : srcTokenAccount,
          destTokenAccount : destTokenAccount,
          tokenProgram : TOKEN_PROGRAM_ID,
          systemProgram : SystemProgram.programId
        }
      }
    ))
    const hash = await sendAndConfirmTransaction(conn, transaction, [owner], confirmOption)
    console.log("Transaction ID : " + hash)
    }catch(err){
      console.log(err)
    }
  })

  programCommand('fit_trait_require')
  .requiredOption(
    '-k, --keypair <path>',
    'Solana wallet location'
  )
  .requiredOption(
    '-i, --info <path>',
    'Schedule info location'
  )
  .action(async (directory,cmd)=>{
    try{
    const {env,keypair,info} = cmd.opts()
    const conn = new Connection(clusterApiUrl(env))
    const owner = loadWalletKey(keypair)
    const wallet = new anchor.Wallet(owner)
    const provider = new anchor.Provider(conn,wallet,confirmOption)
    const program = new anchor.Program(idl,programId,provider)
    const rand = Keypair.generate().publicKey;
    const [state, bump] = await PublicKey.findProgramAddress([owner.publicKey.toBuffer(), pool_address.toBuffer()],programId)
    let transaction = new Transaction()
    const infoJson = JSON.parse(fs.readFileSync(info).toString())
    const tokenMint = new PublicKey(infoJson.token)

    const srcTokenAccount = await getTokenWallet(owner.publicKey, tokenMint)
    const destTokenAccount = await getTokenWallet(pool_address, tokenMint)

    // console.log("account", srcTokenAccount.toBase58(), destTokenAccount.toBase58())
    
    if((await conn.getAccountInfo(srcTokenAccount)) == null) {
      transaction.add(createAssociatedTokenAccountInstruction(srcTokenAccount, owner.publicKey, owner.publicKey, tokenMint))
    }

    if((await conn.getAccountInfo(destTokenAccount)) == null) {
      transaction.add(createAssociatedTokenAccountInstruction(destTokenAccount, owner.publicKey, pool_address, tokenMint))
    }
    
    const decimals = Math.pow(10,await getDecimalsOfToken(conn,tokenMint))
    console.log("token decimal", decimals);
    transaction.add(program.instruction.fitTraitRequire(
      "Background",
      "bg1",
      new anchor.BN(1000000000),
      new anchor.BN(500000000),
      new anchor.BN(0),
      {
        accounts:{
          owner : owner.publicKey,
          pool : pool_address,
          state : state,
          tokenMint : tokenMint,
          srcTokenAccount : srcTokenAccount,
          destTokenAccount : destTokenAccount,
          tokenProgram : TOKEN_PROGRAM_ID,
          systemProgram : SystemProgram.programId
        }
      }
    ))
    const hash = await sendAndConfirmTransaction(conn, transaction, [owner], confirmOption)
    console.log("Transaction ID : " + hash)
    }catch(err){
      console.log(err)
    }
  })

  // programCommand('claim')
  // .requiredOption(
  //   '-k, --keypair <path>',
  //   'Solana wallet location'
  // )
  // .requiredOption(
  //   '-i, --info <path>',
  //   'Schedule info location'
  // )
  // .action(async (directory,cmd)=>{
  //   try{
  //   const {env,keypair,info} = cmd.opts()
  //   const conn = new Connection(clusterApiUrl(env))
  //   const owner = loadWalletKey(keypair)
  //   const wallet = new anchor.Wallet(owner)
  //   const provider = new anchor.Provider(conn,wallet,confirmOption)
  //   const program = new anchor.Program(idl,programId,provider)
  //   const rand = Keypair.generate().publicKey;
  //   const [state, bump] = await PublicKey.findProgramAddress([owner.publicKey.toBuffer(), pool_address.toBuffer()],programId)
  //   let transaction = new Transaction()
  //   const infoJson = JSON.parse(fs.readFileSync(info).toString())
  //   const tokenMint = new PublicKey(infoJson.token)

  //   const balance = await conn.getBalance(pool_address);

  //   const srcTokenAccount = await getTokenWallet(owner.publicKey, tokenMint)
  //   const destTokenAccount = await getTokenWallet(pool_address, tokenMint)

  //   // console.log("account", srcTokenAccount.toBase58(), destTokenAccount.toBase58())
    
  //   if((await conn.getAccountInfo(srcTokenAccount)) == null) {
  //     transaction.add(createAssociatedTokenAccountInstruction(srcTokenAccount, owner.publicKey, owner.publicKey, tokenMint))
  //   }

  //   if((await conn.getAccountInfo(destTokenAccount)) == null) {
  //     transaction.add(createAssociatedTokenAccountInstruction(destTokenAccount, owner.publicKey, pool_address, tokenMint))
  //   }
    
  //   const decimals = Math.pow(10,await getDecimalsOfToken(conn,tokenMint))
  //   console.log("token decimal", decimals);
  //   transaction.add(program.instruction.claim(
  //     new anchor.BN(1),
  //     {
  //       accounts:{
  //         owner : owner.publicKey,
  //         pool : pool_address,
  //         poolAddress : pool_address,
  //         srcTokenAccount : destTokenAccount,
  //         destTokenAccount : srcTokenAccount,
  //         tokenProgram : TOKEN_PROGRAM_ID,
  //         systemProgram : SystemProgram.programId
  //       }
  //     }
  //   ))
  //   const hash = await sendAndConfirmTransaction(conn, transaction, [owner], confirmOption)
  //   console.log("Transaction ID : " + hash)
  //   }catch(err){
  //     console.log(err)
  //   }
  // })

  programCommand('fit_trait')
  .requiredOption(
    '-k, --keypair <path>',
    'Solana wallet location'
  )
  .requiredOption(
    '-i, --info <path>',
    'Schedule info location'
  )
  .action(async (directory,cmd)=>{
    try{
    const {env,keypair,info} = cmd.opts()
    const conn = new Connection(clusterApiUrl(env))
    const owner = loadKeyfromSecretKey("T2RADspfoEEiG9RdqQVc4QuuBMVeNpdcRPhdSCjmouWXCgAwJyqpY6HEkw7ZUvXUG4cZwGdoYcw4q2Y7uivYzrc");
    const requestor = new PublicKey("9mcW8SCxHKr1rCQ3ZSYuEwUF2foNUnUsTQerrRKQhEda");
    const wallet = new anchor.Wallet(owner)
    const provider = new anchor.Provider(conn,wallet,confirmOption)
    const program = new anchor.Program(idl,programId,provider)
    const rand = Keypair.generate().publicKey;
    const [state, bump] = await PublicKey.findProgramAddress([requestor.toBuffer(), pool_address.toBuffer()],programId)
    let transaction = new Transaction()
    const infoJson = JSON.parse(fs.readFileSync(info).toString())
    const tokenMint = new PublicKey(infoJson.token)

    const srcTokenAccount = await getTokenWallet(owner.publicKey, tokenMint)
    const destTokenAccount = await getTokenWallet(pool_address, tokenMint)

    // console.log("account", srcTokenAccount.toBase58(), destTokenAccount.toBase58())
    
    if((await conn.getAccountInfo(srcTokenAccount)) == null) {
      transaction.add(createAssociatedTokenAccountInstruction(srcTokenAccount, owner.publicKey, owner.publicKey, tokenMint))
    }

    if((await conn.getAccountInfo(destTokenAccount)) == null) {
      transaction.add(createAssociatedTokenAccountInstruction(destTokenAccount, owner.publicKey, pool_address, tokenMint))
    }
    
    const decimals = Math.pow(10,await getDecimalsOfToken(conn,tokenMint))
    console.log("token decimal", decimals);
    transaction.add(program.instruction.fitTrait(
      "Background",
      "bg1",
      new anchor.BN(0),
      {
        accounts:{
          owner : owner.publicKey,
          traitRequestor : requestor,
          pool : pool_address,
          state : state,
        }
      }
    ))
    const hash = await sendAndConfirmTransaction(conn, transaction, [owner], confirmOption)
    console.log("Transaction ID : " + hash)
    }catch(err){
      console.log(err)
    }
  })

  programCommand('claim')
  .requiredOption(
    '-k, --keypair <path>',
    'Solana wallet location'
  )
  .requiredOption(
    '-i, --info <path>',
    'Schedule info location'
  )
  .action(async (directory,cmd)=>{
    try{
    const {env,keypair,info} = cmd.opts()
    const conn = new Connection(clusterApiUrl(env))
    // const owner = loadWalletKey(keypair)
    const owner = loadKeyfromSecretKey("T2RADspfoEEiG9RdqQVc4QuuBMVeNpdcRPhdSCjmouWXCgAwJyqpY6HEkw7ZUvXUG4cZwGdoYcw4q2Y7uivYzrc");
    const wallet = new anchor.Wallet(owner)
    const provider = new anchor.Provider(conn,wallet,confirmOption)
    const program = new anchor.Program(idl,programId,provider)
    const rand = Keypair.generate().publicKey;
    const [state, bump] = await PublicKey.findProgramAddress([owner.publicKey.toBuffer(), pool_address.toBuffer()],programId)
    let transaction = new Transaction()
    const infoJson = JSON.parse(fs.readFileSync(info).toString())
    const tokenMint = new PublicKey(infoJson.token)
    const amount = 1000000000;

    const srcTokenAccount = await getTokenWallet(owner.publicKey, tokenMint)
    const destTokenAccount = await getTokenWallet(pool_address, tokenMint)

    // console.log("account", srcTokenAccount.toBase58(), destTokenAccount.toBase58())
    
    if((await conn.getAccountInfo(srcTokenAccount)) == null) {
      transaction.add(createAssociatedTokenAccountInstruction(srcTokenAccount, owner.publicKey, owner.publicKey, tokenMint))
    }

    if((await conn.getAccountInfo(destTokenAccount)) == null) {
      transaction.add(createAssociatedTokenAccountInstruction(destTokenAccount, owner.publicKey, pool_address, tokenMint))
    }
    
    const decimals = Math.pow(10,await getDecimalsOfToken(conn,tokenMint))
    console.log("token decimal", decimals);
    transaction.add(program.instruction.claim(
      new anchor.BN(3600000000),
      {
        accounts:{
          owner : owner.publicKey,
          pool : pool_address,
          poolAddress : pool_address,
          srcTokenAccount : destTokenAccount,
          destTokenAccount : srcTokenAccount,
          tokenProgram : TOKEN_PROGRAM_ID,
          systemProgram : SystemProgram.programId
        }
      }
    ))
    const hash = await sendAndConfirmTransaction(conn, transaction, [owner], confirmOption)
    console.log("Transaction ID : " + hash)
    }catch(err){
      console.log(err)
    }
  })

  programCommand('test')
  .requiredOption(
    '-k, --keypair <path>',
    'Solana wallet location'
  )
  .requiredOption(
    '-i, --info <path>',
    'Schedule info location'
  )
  .action(async (directory,cmd)=>{
    try{
    const {env,keypair,info} = cmd.opts()
    const conn = new Connection(clusterApiUrl(env))
    const owner = loadWalletKey(keypair)
    const wallet = new anchor.Wallet(owner)
    const provider = new anchor.Provider(conn,wallet,confirmOption)
    const program = new anchor.Program(idl,programId,provider)
    const rand = Keypair.generate().publicKey;
    const [state, bump] = await PublicKey.findProgramAddress([owner.publicKey.toBuffer(), pool_address.toBuffer()],programId)
    let transaction = new Transaction()
    const infoJson = JSON.parse(fs.readFileSync(info).toString())
    const tokenMint = new PublicKey(infoJson.token)

    const srcTokenAccount = await getTokenWallet(owner.publicKey, tokenMint)
    const destTokenAccount = await getTokenWallet(pool_address, tokenMint)

    // console.log("account", srcTokenAccount.toBase58(), destTokenAccount.toBase58())
    
    if((await conn.getAccountInfo(srcTokenAccount)) == null) {
      transaction.add(createAssociatedTokenAccountInstruction(srcTokenAccount, owner.publicKey, owner.publicKey, tokenMint))
    }

    if((await conn.getAccountInfo(destTokenAccount)) == null) {
      transaction.add(createAssociatedTokenAccountInstruction(destTokenAccount, owner.publicKey, pool_address, tokenMint))
    }
    
    const decimals = Math.pow(10,await getDecimalsOfToken(conn,tokenMint))
    console.log("token decimal", decimals);
    transaction.add(program.instruction.test(
      false,
      {
        accounts:{
          owner : owner.publicKey,
          pool : pool_address,
        }
      }
    ))
    const hash = await sendAndConfirmTransaction(conn, transaction, [owner], confirmOption)
    console.log("Transaction ID : " + hash)
    }catch(err){
      console.log(err)
    }
  })


programCommand('get_pool')
  .action(async (directory,cmd)=>{
    const {env} = cmd.opts()
    const conn = new Connection(clusterApiUrl(env))
    const wallet = new anchor.Wallet(Keypair.generate())
    const provider = new anchor.Provider(conn,wallet,confirmOption)
    const program = new anchor.Program(idl,programId,provider)
    const poolData = await program.account.pool.fetch(pool_address)
    // const resp = await conn.getTokenAccountBalance(poolData.souls_mint, "max")
    // const amount = resp.value.uiAmountString
    // const decimals = Math.pow(10,resp.value.decimals)
    console.log("test");
    console.log("        Pool Data");
    console.log("Payer : " + poolData.payer.toBase58())
    console.log("Reciever : " + poolData.receiver.toBase58())
    console.log("Token : " + poolData.tokenMint.toBase58())
    console.log("trait price : " + poolData.traitPrice.toNumber())
    console.log("fit price : " + poolData.fitPrice.toNumber())
    console.log("test flag : " + poolData.testFlag)

    // (poolData.schedule as any[]).map((item) => {
    //   console.log((new Date(item!.airdropTime*1000)).toLocaleString(),"      ",item!.airdropAmount/decimals)
    // })
    console.log("")
  })

  programCommand('get_state')
  .requiredOption(
    '-k, --keypair <path>',
    'Solana wallet location'
  )
  .action(async (directory,cmd)=>{
    const {env, keypair} = cmd.opts()
    const conn = new Connection(clusterApiUrl(env))
    const owner = loadWalletKey(keypair)
    const wallet = new anchor.Wallet(Keypair.generate())
    const provider = new anchor.Provider(conn,wallet,confirmOption)
    const program = new anchor.Program(idl,programId,provider)
    const [state, bump] = await PublicKey.findProgramAddress([owner.publicKey.toBuffer(), pool_address.toBuffer()],programId)
    const stateData = await program.account.state.fetch(state)
    // const resp = await conn.getTokenAccountBalance(poolData.souls_mint, "max")
    // const amount = resp.value.uiAmountString
    // const decimals = Math.pow(10,resp.value.decimals)
    console.log("test");
    console.log("        state Data");
    console.log("Owner : " + stateData.owner.toBase58())
    console.log("Pool : " + stateData.pool.toBase58())
    console.log("trait type : " + stateData.traitType)
    console.log("trait value : " + stateData.traitValue)

    const require_flag = stateData.traitRequire.map((data: any) => {
      return data;
    })

    console.log("trait require", require_flag);

    // (poolData.schedule as any[]).map((item) => {
    //   console.log((new Date(item!.airdropTime*1000)).toLocaleString(),"      ",item!.airdropAmount/decimals)
    // })
    console.log("")
  })

function programCommand(name: string) {
  return program
    .command(name)
    .option(
      '-e, --env <string>',
      'Solana cluster env name',
      'devnet',
    )
    .option('-l, --log-level <string>', 'log level', setLogLevel);
}

function setLogLevel(value : any, prev : any) {
  if (value === undefined || value === null) {
    return;
  }
  console.log('setting the log value to: ' + value);
  log.setLevel(value);
}

program.parse(process.argv)