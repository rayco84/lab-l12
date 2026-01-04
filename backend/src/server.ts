import express, { Express, Request, Response, NextFunction, RequestHandler } from 'express'
import bodyParser from 'body-parser'
import dotenv from 'dotenv'
import { Setup, sdk } from '@bsv/wallet-toolbox'
import { EventLogger, EventLogResult } from './EventLogger.js'
import { createAuthMiddleware, AuthRequest } from '@bsv/auth-express-middleware'
import { createPaymentMiddleware } from '@bsv/payment-express-middleware'
import { webcrypto } from 'crypto'
import { PubKeyHex, VerifiableCertificate } from '@bsv/sdk'

// Load env variables
dotenv.config()

// crypto polyfill for paymentMid
if (!globalThis.crypto) globalThis.crypto = webcrypto as typeof globalThis.crypto

const SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY || ''
const WALLET_STORAGE_URL = process.env.WALLET_STORAGE_URL || 'https://storage.babbage.systems'
const BSV_NETWORK = process.env.BSV_NETWORK || 'main'
const HTTP_PORT = process.env.HTTP_PORT || '3000'
const CERTIFIER_IDENTITY_KEY = process.env.CERTIFIER_IDENTITY_KEY!
const CERTIFICATE_TYPE_ID = process.env.CERTIFICATE_TYPE_ID!

type CertificateMap = Record<PubKeyHex, VerifiableCertificate[]>
const CERTIFICATES_RECEIVED: CertificateMap = {}

let eventLogger: EventLogger        // declare at module lvl (outsie of initialize())

interface LogEventRequest {
    eventData: Record<string, any>
}

interface LogEventResponse {
    txid: string
    message: string
}

const app: Express = express()
const port = parseInt(HTTP_PORT, 10)

async function initialize() {


    // TODO 1: Initialize BSV wallet
    const wallet = await Setup.createWalletClientNoEnv({
        chain: BSV_NETWORK as sdk.Chain,
        rootKeyHex: SERVER_PRIVATE_KEY,
        storageUrl: WALLET_STORAGE_URL
    })


    // TODO 2: Create EventLogger instance
    eventLogger = new EventLogger(wallet)


    
    // TODO 3: Configure body-parser middleware
    app.use(bodyParser.json({ limit: '64mb' }))
    app.use(bodyParser.urlencoded({ extended: true, limit: '64mb'}))


    // TODO 4: Set up CORS middleware
    const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Headers', '*')
    res.header('Access-Control-Allow-Methods', '*')
    res.header('Access-Control-Expose-Headers', '*')
    res.header('Access-Control-Allow-Private-Network', 'true')
    if (req.method === 'OPTIONS') {
      res.sendStatus(200)
      return
    }
    next()
    }

    app.use(corsMiddleware)

    // ++ ADD AUTHENTICATION MIDDLEWARE
  const authMiddleware = createAuthMiddleware({
    wallet,
    allowUnauthenticated: false,
    logger: console,
    logLevel: 'debug',
    certificatesToRequest: {
      certifiers: [CERTIFIER_IDENTITY_KEY],
      types: {
        [CERTIFICATE_TYPE_ID]: ['cool']
      }
    },
    onCertificatesReceived: (
      senderPublicKey: string,
      certs: VerifiableCertificate[],
      req: AuthRequest,
      res: Response,
      next: NextFunction
    ) => {
      console.log('CERTS RECEIVED from', senderPublicKey, certs)
      if (!CERTIFICATES_RECEIVED[senderPublicKey]) {
        CERTIFICATES_RECEIVED[senderPublicKey] = []
      }
      CERTIFICATES_RECEIVED[senderPublicKey].push(...certs)
      next()
    }
  })

  app.use(authMiddleware)


    // ++ ADD PAYMENT MIDDLEWARE
    const paymentMiddleware = createPaymentMiddleware({         // create the payment middleware instance (lab-10)
        wallet,
        calculateRequestPrice: async (req) => {
        if (req.url === '/log-event') {
                const body = (req as any).body
                if (!body || !body.eventData) {
                        return 2500
            }

            const eventDataJSON = JSON.stringify(body.eventData)
            const dataSize = Buffer.from(eventDataJSON, 'utf8').length

            // estimate price & calc by data size to reduce fees
            const BASE_FEE = 1000
            const SATOSHIS_PER_BYTE = 10

            const totalCost = BASE_FEE + (dataSize * SATOSHIS_PER_BYTE)

            console.log(`[Payment] Event data size: ${dataSize} bytes, Total Cost: ${totalCost} satoshis`)

            return totalCost
        }
            return 0  // retrieve logs fee
        }
})

  app.use(paymentMiddleware)

    // Define interface for payments requests
    interface PaymentAuthRequest extends AuthRequest {
        payment?: {
            satoshisPaid: number
    }
  }


    // TODO 5: Implement /log-event POST endpoint
    app.post('/log-event', async (req, res) => {
        try {
            const { eventData } = req.body as LogEventRequest
            const result = await eventLogger.logEvent(eventData)
            res.json(result)
        }   catch (error) {
            console.error('Error logging event:', error)
            res.status(500).json({ error: 'Failed to log event' })
        }
    })


    // TODO 6: Implement /retreive-logs GET endpoint
    app.get('/retrieve-logs', async (req, res) => {
        try {
            const logs = await eventLogger.retrieveLogs()
            res.json({ logs })
        }   catch (error) {
            console.error('Error retrieving logs:', error)
            res.status(500).json({ error: 'Failed to retrieve logs' })
        }
    })


    // TODO 7: Start the Express server
    app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
    })
    
}

initialize().catch(err => {
    console.error('Failed to initialize backend wallet:', err)
    process.exit(1)
})