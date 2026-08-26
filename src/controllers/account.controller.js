const accountModel = require("../models/account.model");


async function createAccountController(req, res) {

    try {

        const user = req.user;

        const account = await accountModel.create({
            user: user._id
        })

        res.status(201).json({
            account
        })

    } catch (error) {
        return res.status(500).json({
            message: "Internal server error while creating account",
            error: error.message
        })
    }

}

async function getUserAccountsController(req, res) {

    try {

        const accounts = await accountModel.find({ user: req.user._id });

        res.status(200).json({
            accounts
        })

    } catch (error) {
        return res.status(500).json({
            message: "Internal server error while fetching accounts",
            error: error.message
        })
    }

}

async function getAccountBalanceController(req, res) {

    try {

        const { accountId } = req.params;

        const account = await accountModel.findOne({
            _id: accountId,
            user: req.user._id
        })

        if (!account) {
            return res.status(404).json({
                message: "Account not found"
            })
        }

        const balance = await account.getBalance();

        res.status(200).json({
            accountId: account._id,
            balance: balance
        })

    } catch (error) {
        return res.status(500).json({
            message: "Internal server error while fetching balance",
            error: error.message
        })
    }

}


module.exports = {
    createAccountController,
    getUserAccountsController,
    getAccountBalanceController
}