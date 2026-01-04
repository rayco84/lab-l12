import {
    PushDrop,
    Utils,
    Transaction,
    WalletInterface,
    WalletProtocol,
    WERR_REVIEW_ACTIONS
}   from '@bsv/sdk'

export interface EventLogResult {
    txid: string
    message: string
    timestamp: string
}

export class EventLogger {
    private wallet: WalletInterface
    private pushdrop: PushDrop

    private readonly PROTOCOL_ID: WalletProtocol = [1, 'Event Logger']
    private readonly KEY_ID = '1'
    private readonly BASKET_NAME = 'event logs v2'

    constructor(wallet: WalletInterface) {
        this.wallet = wallet
        this.pushdrop = new PushDrop(wallet)
    }

    async logEvent(
        eventData: Record<string, any>,
        testWerrLabel = false
    ) : Promise<Omit<EventLogResult, 'timestamp' >> {
        const timestamp = new Date().toISOString()
        const ip = 'unknown'
        const endpoint = '/log-event'

        const payload = {
            ip,
            timestamp,
            endpoint,
            ...eventData
        }

        // TODO 1: Validate eventData and enhance error handling
        if (!eventData || typeof eventData !== 'object' || Array.isArray(eventData)) {      // check if exists, is obj, isArray
            throw new Error('Invalid eventData: must be non-empty object')    
        }
        if (Object.keys(eventData).length === 0) {
            throw new Error('Invalid eventData: object cannot be empty')
}

        // TODO 2: Validate PushDrop script genration
        try {
            const encodedPayload = Utils.toArray(JSON.stringify(payload), 'utf8')

            const lockingScript = await this.pushdrop.lock(
                [encodedPayload],
                this.PROTOCOL_ID,
                this.KEY_ID,
                'self',
                true
            )
            if (!lockingScript) {
                throw new Error('Failed to generate PushDrop locking script')
            }
        

        // TODO 3: Validate transaction ID and handle broadcast errors
            const action = await this.wallet.createAction({
                outputs: [{
                    lockingScript: lockingScript.toHex(),
                    satoshis: 1,
                    basket: this.BASKET_NAME,
                    outputDescription: "Event log token"
                }],
                description: 'Log event to blockchain',
                options: {
                    randomizeOutputs: false,
                    acceptDelayedBroadcast: false
                }
            })

        const txid = action.txid

        if (!txid) {
            throw new Error('Transaction created but no txid returned')
        }

        return {
            txid: txid ?? 'unknown-txid',
            message: 'Event logged successfully'
        }
    }   catch (err: unknown) {
        if (err instanceof WERR_REVIEW_ACTIONS) {
            console.error('[logEvent] Wallet threw WERR_REVIEW_ACTIONS:', {
                code: err.code,
                message: err.message,
                reviewActionsResults: err.reviewActionResults,
                sendWithResults: err.sendWithResults,
                txid: err.txid,
                tx: err.tx,
                noSendChange: err.noSendChange
            })
        }   else if (err instanceof Error) {
            console.error('[logEvent] Failed wiht error status:', {
                message: err.message,
                name: err.name,
                stack: err.stack,
                error: err
            })
        }   else {
            console.error('[logEvent] Failed with unknown error:', err)
            }
            throw err
        }
    }

async retrieveLogs(): Promise<EventLogResult[]> {
    console.log('[retrieveLogs] Fetching outputs from basket:', this.BASKET_NAME)

    // TODO 4: Optimize log retrieval for large datasets
    const { outputs, BEEF } = await this.wallet.listOutputs({
        basket: this.BASKET_NAME,
        include: 'entire transactions'
    })

    if (!BEEF) {
      console.warn('[retrieveLogs] No BEEF returned, cannot proceed.')
      return []
    }

    const logs: EventLogResult[] = []

    // TODO 5: Process blockchain data with validation and optimization
    const logsOrNull = await Promise.all(
        outputs.map(async (entry: any) => {
            try {
                const [txid, voutStr] = entry.outpoint.split('.')
                const outputIndex = parseInt(voutStr, 10)

                if (!BEEF || isNaN(outputIndex)) return null

                const tx = Transaction.fromBEEF(BEEF, txid)
                const output = tx.outputs[outputIndex]
                if (!output) return null

                const lockingScript = output.lockingScript

                const decoded = PushDrop.decode(lockingScript)
                const encodedPayload = decoded.fields[0]

                console.log('[retreiveLogs] Decoding log from output:', entry.outpoint)

                const payloadJSON = Utils.toUTF8(encodedPayload)
                const payload = JSON.parse(payloadJSON)

                console.log('[retreiveLogs] Decoded log:', payload)

                return {
                    txid,
                    message: 'Event retreived successfully',
                    timestamp: payload.timestamp
                }
            }   catch (err) {
                console.warn('[retreiveLogs] Failed to process entry:', entry, err)
                return null
            }
        })
    )

    const filteredLogs = logsOrNull.filter((log): log is EventLogResult => log !== null)

    return filteredLogs
  }
}