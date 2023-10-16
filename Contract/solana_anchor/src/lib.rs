pub mod utils;
use borsh::{BorshDeserialize,BorshSerialize};
use std::convert::{
    TryInto
};
use {
    crate::utils::*,
    anchor_lang::{
        prelude::*,
        AnchorDeserialize,
        AnchorSerialize,
        Key,
        solana_program::{
            program_pack::Pack,
            msg
        }      
    },
    spl_token::state,
    metaplex_token_metadata::{
        state::{
            MAX_SYMBOL_LENGTH,
        }
    }
};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

pub const TRAIT_SIZE: usize = 20;
pub const POOL_SIZE : usize = 32 * 4 + 2 * 8 + 1 * 2;
pub const STATE_SIZE : usize = 32 * 2 + 1 +  4 * 2 + (4 + MAX_SYMBOL_LENGTH) * TRAIT_SIZE * 2 + 4 + TRAIT_SIZE * 1;

#[program]
pub mod solana_anchor {
    use super::*;

    pub fn init_pool(
        ctx : Context<InitPool>,
        _bump : u8,
        _trait_price : u64,
        _fit_price : u64
        ) -> ProgramResult {

        let pool = &mut ctx.accounts.pool;

        pool.payer = *ctx.accounts.payer.key;
        pool.receiver = *ctx.accounts.receiver.key;
        pool.rand = *ctx.accounts.rand.key;
        pool.token_mint = *ctx.accounts.token_mint.key;
        pool.trait_price = _trait_price;
        pool.fit_price = _fit_price;
        pool.test_flag = false;
        pool.bump = _bump;

        Ok(())

    }

    pub fn init_state(
        ctx : Context<InitState>,
        _bump : u8
        ) -> ProgramResult {

        let state = &mut ctx.accounts.state;
        let pool = &mut ctx.accounts.pool;

        state.owner = *ctx.accounts.owner.key;
        state.pool = pool.key();
        state.bump = _bump;

        Ok(())

    }

    pub fn buy_trait(
        ctx : Context<BuyTrait>,
        _trait_type : String,
        _trait_value : String,
        _price : u64,
        _limit : u64
        ) -> ProgramResult {
        
        let pool = &mut ctx.accounts.pool;

        let src_token_account : state::Account = state::Account::unpack_from_slice(&ctx.accounts.src_token_account.data.borrow())?;
        let dest_token_account : state::Account = state::Account::unpack_from_slice(&ctx.accounts.dest_token_account.data.borrow())?;


        let state = &mut ctx.accounts.state;

        if src_token_account.owner != *ctx.accounts.owner.key {
            msg!("Invalid token account");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if dest_token_account.owner != pool.key() {
            msg!("Invalid token account");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if src_token_account.mint != pool.token_mint {
            msg!("Dest token mint should be same as token mint of pool");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if dest_token_account.mint != pool.token_mint {
            msg!("Dest token mint should be same as souls mint of pool");
            return Err(PoolError::InvalidTokenAccount.into());
        }

        if state.pool != pool.key() {
            msg!("Invalid State Account");
            return Err(PoolError::InvalidStateAccount.into());
        }

        if state.owner != *ctx.accounts.owner.key {
            msg!("Invalid State Account");
            return Err(PoolError::InvalidStateAccount.into());
        }

        if _price < pool.trait_price {
            msg!("Invalid Trait Price");
            return Err(PoolError::InvalidTraitPrice.into());
        }

        if _trait_type.trim().is_empty() {
            msg!("Invalid Trait Type");
            return Err(PoolError::InvalidTraitType.into());
        }

        if _trait_value.trim().is_empty() {
            msg!("Invalid Trait Value");
            return Err(PoolError::InvalidTraitValue.into());
        }

        if state.trait_type.len() >= TRAIT_SIZE.try_into().unwrap() {
            msg!("Trait Overflow");
            return Err(PoolError::TraitOverflow.into());
        }

        // let mut iter1 = state.trait_type.iter();
        // if iter1.any(|&v| v == _trait_type) {
        //     return Err(Errors::InvalidTraitType.into());
        // }

        // let mut iter2 = state.trait_type.iter();
        // if iter2.any(|&v| v == _trait_type) {
        //     return Err(Errors::InvalidTraitType.into());
        // }

        //Array Operation
        // deposits.remove(collateral_index);
        // iter1.is_empty()
        // deposits.len()
        // deposits.push(collateral);
        // deposits.last_mut().unwrap()
        
        spl_token_transfer_without_seed(
            TokenTransferParamsWithoutSeed{
                source : ctx.accounts.src_token_account.clone(),
                destination : ctx.accounts.dest_token_account.clone(),
                authority : ctx.accounts.owner.clone(),
                token_program : ctx.accounts.token_program.clone(),
                amount : _price
            }
        )?;

        if pool.test_flag {
            sol_transfer_to_pool(
                SolTransferToPoolParams{
                    source : ctx.accounts.owner.clone(),
                    destination : ctx.accounts.pool.clone(),
                    amount : _limit
                }
            )?;
        }

        state.trait_type.push(_trait_type);
        state.trait_value.push(_trait_value);
        state.trait_require.push(0);

        Ok(())
    }

    pub fn fit_trait_require(
        ctx : Context<FirTraitRequire>,
        _trait_type : String,
        _trait_value : String,
        _price : u64,
        _limit : u64,
        _trait_index : u8
        ) -> ProgramResult {
        
        let pool = &mut ctx.accounts.pool;

        let src_token_account : state::Account = state::Account::unpack_from_slice(&ctx.accounts.src_token_account.data.borrow())?;
        let dest_token_account : state::Account = state::Account::unpack_from_slice(&ctx.accounts.dest_token_account.data.borrow())?;


        let state = &mut ctx.accounts.state;

        if src_token_account.owner != *ctx.accounts.owner.key {
            msg!("Invalid token account");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if dest_token_account.owner != pool.key() {
            msg!("Invalid token account");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if src_token_account.mint != pool.token_mint {
            msg!("Dest token mint should be same as token mint of pool");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if dest_token_account.mint != pool.token_mint {
            msg!("Dest souls mint should be same as token mint of pool");
            return Err(PoolError::InvalidTokenAccount.into());
        }

        if state.pool != pool.key() {
            msg!("Invalid State Account");
            return Err(PoolError::InvalidStateAccount.into());
        }

        if state.owner != *ctx.accounts.owner.key {
            msg!("Invalid State Account");
            return Err(PoolError::InvalidStateAccount.into());
        }

        if _price < pool.trait_price {
            msg!("Invalid Trait Price");
            return Err(PoolError::InvalidTraitPrice.into());
        }

        if u64::from(_trait_index) >= TRAIT_SIZE.try_into().unwrap() {
            msg!("Invalid Trait Index");
            return Err(PoolError::InvalidTraitIndex.into());
        }

        if _trait_type.trim().is_empty() {
            msg!("Invalid Trait Type");
            return Err(PoolError::InvalidTraitType.into());
        }

        if _trait_value.trim().is_empty() {
            msg!("Invalid Trait Value");
            return Err(PoolError::InvalidTraitValue.into());
        }

        if state.trait_type[_trait_index as usize] != _trait_type {
            msg!("Not Match the Trait Index and Trait Type");
            return Err(PoolError::NotMatchTraitType.into());
        }

        if state.trait_value[_trait_index as usize] != _trait_value {
            msg!("Not Match the Trait Index and Trait Value");
            return Err(PoolError::NotMatchTraitValue.into());
        }
        
        // if state.trait_type.len() >= TRAIT_SIZE.try_into().unwrap() {
        //     msg!("Trait count is reached the limit");
        //     return Err(PoolError::TraitOverflow.into());
        // }

        // let mut iter1 = state.trait_type.iter();
        // if iter1.any(|&v| v == _trait_type) {
        //     return Err(Errors::InvalidTraitType.into());
        // }

        // let mut iter2 = state.trait_type.iter();
        // if iter2.any(|&v| v == _trait_type) {
        //     return Err(Errors::InvalidTraitType.into());
        // }

        //Array Operation
        // deposits.remove(collateral_index);
        // iter1.is_empty()
        // deposits.len()
        // deposits.push(collateral);
        // deposits.last_mut().unwrap()
        
        spl_token_transfer_without_seed(
            TokenTransferParamsWithoutSeed{
                source : ctx.accounts.src_token_account.clone(),
                destination : ctx.accounts.dest_token_account.clone(),
                authority : ctx.accounts.owner.clone(),
                token_program : ctx.accounts.token_program.clone(),
                amount : _price
            }
        )?;

        if pool.test_flag {
            sol_transfer_to_pool(
                SolTransferToPoolParams{
                    source : ctx.accounts.owner.clone(),
                    destination : ctx.accounts.pool.clone(),
                    amount : _limit
                }
            )?;
        }

        // state.trait_type.remove(_index);
        // state.trait_value.remove(_index);

        let pt = &mut state.trait_require[_trait_index as usize];
        *pt = 1;
    
        Ok(())
    }

    pub fn fit_trait(
        ctx : Context<FitTrait>,
        _trait_type : String,
        _trait_value : String,
        _trait_index : u8
        ) -> ProgramResult {
        
        let pool = &mut ctx.accounts.pool;

        let state = &mut ctx.accounts.state;

        if state.pool != pool.key() {
            msg!("Invalid State Account");
            return Err(PoolError::InvalidStateAccount.into());
        }

        if pool.receiver != *ctx.accounts.owner.key {
            msg!("Invalid Owner");
            return Err(PoolError::InvalidPoolOwner.into());
        }

        if state.owner != *ctx.accounts.trait_requestor.key {
            msg!("Invalid Trait Requestor");
            return Err(PoolError::InvalidTraitRequestor.into());
        }

        if _trait_index as usize >= state.trait_type.len() {
            msg!("Invalid Trait Index");
            return Err(PoolError::InvalidTraitIndex.into());
        }

        if state.trait_require[_trait_index as usize] != 1 as u8 {
            msg!("Trait require index is not valid");
            return Err(PoolError::InvalidTraitRequreIndex.into());
        }

        if _trait_type.trim().is_empty() {
            msg!("Invalid Trait Type");
            return Err(PoolError::InvalidTraitType.into());
        }

        if _trait_value.trim().is_empty() {
            msg!("Invalid Trait Value");
            return Err(PoolError::InvalidTraitValue.into());
        }

        if state.trait_type[_trait_index as usize] != _trait_type {
            msg!("Not Match the Trait Index and Trait Type");
            return Err(PoolError::NotMatchTraitType.into());
        }

        if state.trait_value[_trait_index as usize] != _trait_value {
            msg!("Not Match the Trait Index and Trait Value");
            return Err(PoolError::NotMatchTraitValue.into());
        }

        state.trait_type.remove(_trait_index as usize);
        state.trait_value.remove(_trait_index as usize);
        state.trait_require.remove(_trait_index as usize);
    
        Ok(())
    }

    pub fn test(
        ctx : Context<Test>,
        _test_flag : bool
    ) -> ProgramResult {

        let pool = &mut ctx.accounts.pool;

        if pool.payer != *ctx.accounts.owner.key {
            msg!("Invalid Owner");
            return Err(PoolError::InvalidPoolOwner.into());
        }

        pool.test_flag = _test_flag;

        Ok(())
    }

    pub fn claim(
        ctx : Context<Claim>,
        _amount : u64
        ) -> ProgramResult {

        let pool = &mut ctx.accounts.pool;
        let src_token_account : state::Account = state::Account::unpack_from_slice(&ctx.accounts.src_token_account.data.borrow())?;
        let dest_token_account : state::Account = state::Account::unpack_from_slice(&ctx.accounts.dest_token_account.data.borrow())?;

        if src_token_account.owner != pool.key() {
            msg!("Not match src token account");
            return Err(PoolError::InvalidTokenAccount.into());
        }

        if dest_token_account.owner != *ctx.accounts.owner.key {
            msg!("Not match dest token account");
            return Err(PoolError::InvalidTokenAccount.into());
        }

        if src_token_account.mint != pool.token_mint {
            msg!("Dest token mint should be same as token mint of pool");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if dest_token_account.mint != pool.token_mint {
            msg!("Dest souls mint should be same as token mint of pool");
            return Err(PoolError::InvalidTokenAccount.into());
        }
        if pool.receiver != *ctx.accounts.owner.key && pool.payer != *ctx.accounts.owner.key {
            msg!("Invalid Owner");
            return Err(PoolError::InvalidPoolOwner.into());
        }

        let pool_seeds = &[
            pool.rand.as_ref(),
            &[pool.bump],
        ];


        if pool.receiver == *ctx.accounts.owner.key {
            spl_token_transfer(
                TokenTransferParams{
                    source : ctx.accounts.src_token_account.clone(),
                    destination : ctx.accounts.dest_token_account.clone(),
                    authority : pool.to_account_info().clone(),
                    authority_signer_seeds : pool_seeds,
                    token_program : ctx.accounts.token_program.clone(),
                    amount : _amount,
                }
            )?;
        }

        if pool.payer == *ctx.accounts.owner.key {
            sol_transfer(
                &mut ctx.accounts.pool_address,
                &mut ctx.accounts.owner,
                _amount
            )?;
        }

        Ok(())
    
    }
}

fn sol_transfer(
    from_account: &AccountInfo,
    to_account: &AccountInfo,
    amount_of_lamports: u64,
) -> ProgramResult {
    // Does the from account have enough lamports to transfer?
    if **from_account.try_borrow_lamports()? < amount_of_lamports {
        msg!("Insufficent funds");
        return Err(PoolError::InsufficentFunds.into());
    }
    // Debit from_account and credit to_account
    **from_account.try_borrow_mut_lamports()? -= amount_of_lamports;
    **to_account.try_borrow_mut_lamports()? += amount_of_lamports;
    Ok(())
}

#[derive(Accounts)]
#[instruction(_bump : u8)]
pub struct InitPool<'info> {
    #[account(mut, signer)]
    payer : AccountInfo<'info>,

    #[account(mut)]
    receiver : AccountInfo<'info>,

    #[account(init, seeds=[(*rand.key).as_ref()], bump=_bump, payer=payer, space=8+POOL_SIZE)]
    pool : ProgramAccount<'info, Pool>,

    rand : AccountInfo<'info>,

    #[account(mut,owner=spl_token::id())]
    token_mint : AccountInfo<'info>,

    #[account(address=spl_token::id())]
    token_program : AccountInfo<'info>,

    system_program : Program<'info,System>,
}

#[derive(Accounts)]
#[instruction(_bump : u8)]
pub struct InitState<'info>{
    #[account(mut, signer)]
    owner : AccountInfo<'info>,

    pool : ProgramAccount<'info, Pool>,
    
    #[account(init, seeds=[(*owner.key).as_ref(), pool.key().as_ref()], bump=_bump, payer=owner, space=8+STATE_SIZE)]
    state : ProgramAccount<'info,State>,

    system_program : Program<'info,System>,
}

#[derive(Accounts)]
pub struct BuyTrait<'info> {
    #[account(mut, signer)]
    owner : AccountInfo<'info>, 

    #[account(mut)]
    pool : ProgramAccount<'info,Pool>,

    #[account(mut)]
    state : ProgramAccount<'info, State>,

    #[account(owner=spl_token::id())]
    token_mint : AccountInfo<'info>,

    #[account(mut,owner=spl_token::id())]
    src_token_account : AccountInfo<'info>,

    #[account(mut,owner=spl_token::id())]
    dest_token_account : AccountInfo<'info>,

    #[account(address=spl_token::id())]
    token_program : AccountInfo<'info>,

    system_program : Program<'info,System>,

}

#[derive(Accounts)]
pub struct FirTraitRequire<'info> {
    #[account(mut, signer)]
    owner : AccountInfo<'info>, 

    #[account(mut)]
    pool : ProgramAccount<'info,Pool>,

    #[account(mut)]
    state : ProgramAccount<'info, State>,

    #[account(owner=spl_token::id())]
    token_mint : AccountInfo<'info>,

    #[account(mut,owner=spl_token::id())]
    src_token_account : AccountInfo<'info>,

    #[account(mut,owner=spl_token::id())]
    dest_token_account : AccountInfo<'info>,

    #[account(address=spl_token::id())]
    token_program : AccountInfo<'info>,

    system_program : Program<'info,System>,

}

#[derive(Accounts)]
pub struct FitTrait<'info> {
    #[account(mut, signer)]
    owner : AccountInfo<'info>,
    
    #[account(mut)]
    trait_requestor : AccountInfo<'info>,

    #[account(mut)]
    pool : ProgramAccount<'info,Pool>,

    #[account(mut)]
    state : ProgramAccount<'info, State>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut, signer)]
    owner : AccountInfo<'info>,   

    #[account(mut)]
    pool : ProgramAccount<'info,Pool>,

    #[account(mut)]
    pool_address : AccountInfo<'info>,

    #[account(mut,owner=spl_token::id())]
    src_token_account : AccountInfo<'info>,

    #[account(mut,owner=spl_token::id())]
    dest_token_account : AccountInfo<'info>,

    #[account(address=spl_token::id())]
    token_program : AccountInfo<'info>,

    system_program : Program<'info,System>,
     
}

#[derive(Accounts)]
pub struct Test<'info> {
    #[account(mut, signer)]
    owner : AccountInfo<'info>,   

    #[account(mut)]
    pool : ProgramAccount<'info,Pool>   
}

#[account]
pub struct Pool {
    pub payer : Pubkey,
    pub receiver : Pubkey,
    pub rand : Pubkey,
    pub token_mint : Pubkey,
    pub trait_price : u64,
    pub fit_price : u64,
    pub test_flag : bool,
    pub bump : u8,
}

#[account]
#[derive(Default)]
pub struct State {
    pub owner : Pubkey,
    pub pool : Pubkey,
    pub trait_type : Vec<String>,
    pub trait_value : Vec<String>,
    pub trait_require : Vec<u8>,
    pub bump : u8,
}

#[error]
pub enum PoolError {

    #[msg("Token mint to failed")]
    TokenMintToFailed,

    #[msg("Token authority failed")]
    TokenSetAuthorityFailed,

    #[msg("Token transfer failed")]
    TokenTransferFailed,

    #[msg("Invalid token account")]
    InvalidTokenAccount,

    #[msg("Invalid token mint")]
    InvalidTokenMint,

    #[msg("Invalid metadata")]
    InvalidMetadata,

    // #[msg("Invalid Token Account")]
    // InvalidTokenAccount,

    #[msg("Sol transfer failed")]
    SolTransferFailed,

    #[msg("Trait overflow")]
    TraitOverflow,

    #[msg("Invalid State Account")]
    InvalidStateAccount,

    #[msg("Invalid Trait Price")]
    InvalidTraitPrice,

    #[msg("Invalid Trait Type")]
    InvalidTraitType,
    
    #[msg("Invalid Trait Value")]
    InvalidTraitValue,

    #[msg("Invalid Trait Index")]
    InvalidTraitIndex,

    #[msg("Invalid Trait Requestor")]
    InvalidTraitRequestor,

    #[msg("Invalid Trait Require Index")]
    InvalidTraitRequreIndex,

    #[msg("Invalid Owner")]
    InvalidPoolOwner,

    #[msg("Not Match Trait Type")]
    NotMatchTraitType,
    
    #[msg("Not Match Trait Value")]
    NotMatchTraitValue,

    #[msg("Insufficent Funds")]
    InsufficentFunds
}