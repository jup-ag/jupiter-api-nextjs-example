import React, { FunctionComponent, useEffect, useMemo, useState } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import { INPUT_MINT_ADDRESS, OUTPUT_MINT_ADDRESS } from "../../constants";

import styles from "./JupiterForm.module.css";
import { useJupiterApiContext } from "../../contexts/JupiterApiProvider";

interface IJupiterFormProps {}
interface IState {
  amount: number;
  inputMint: PublicKey;
  outputMint: PublicKey;
  slippage: number;
}

const JupiterForm: FunctionComponent<IJupiterFormProps> = (props) => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { tokenMap, routeMap, loaded, api } = useJupiterApiContext();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formValue, setFormValue] = useState<IState>({
    amount: 1 * 10 ** 6, // unit in lamports (Decimals)
    inputMint: new PublicKey(INPUT_MINT_ADDRESS),
    outputMint: new PublicKey(OUTPUT_MINT_ADDRESS),
    slippage: 1, // 0.1%
  });
  const [routes, setRoutes] = useState<
    Awaited<ReturnType<typeof api.v1QuoteGet>>["data"]
  >([]);

  const [inputTokenInfo, outputTokenInfo] = useMemo(() => {
    return [
      tokenMap.get(formValue.inputMint?.toBase58() || ""),
      tokenMap.get(formValue.outputMint?.toBase58() || ""),
    ];
  }, [
    tokenMap,
    formValue.inputMint?.toBase58(),
    formValue.outputMint?.toBase58(),
  ]);

  // Good to add debounce here to avoid multiple calls
  const fetchRoute = React.useCallback(() => {
    setIsLoading(true);
    api
      .v1QuoteGet({
        amount: formValue.amount,
        inputMint: formValue.inputMint.toBase58(),
        outputMint: formValue.outputMint.toBase58(),
        slippage: formValue.slippage,
      })
      .then(({ data }) => {
        if (data) {
          setRoutes(data);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [api, formValue]);

  useEffect(() => {
    fetchRoute();
  }, [fetchRoute]);

  const validOutputMints = useMemo(
    () => routeMap.get(formValue.inputMint?.toBase58() || "") || [],
    [routeMap, formValue.inputMint?.toBase58()]
  );

  // ensure outputMint can be swapable to inputMint
  useEffect(() => {
    if (formValue.inputMint) {
      const possibleOutputs = routeMap.get(formValue.inputMint.toBase58());

      if (
        possibleOutputs &&
        !possibleOutputs?.includes(formValue.outputMint?.toBase58() || "")
      ) {
        setFormValue((val) => ({
          ...val,
          outputMint: new PublicKey(possibleOutputs[0]),
        }));
      }
    }
  }, [formValue.inputMint?.toBase58(), formValue.outputMint?.toBase58()]);

  if (!loaded) {
    return <div>Loading jupiter routeMap...</div>;
  }

  return (
    <div className="max-w-full md:max-w-lg">
      <div className="mb-2">
        <label htmlFor="inputMint" className="block text-sm font-medium">
          Input token
        </label>
        <select
          id="inputMint"
          name="inputMint"
          className="mt-1 bg-neutral block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          value={formValue.inputMint?.toBase58()}
          onChange={(e) => {
            const pbKey = new PublicKey(e.currentTarget.value);
            if (pbKey) {
              setFormValue((val) => ({
                ...val,
                inputMint: pbKey,
              }));
            }
          }}
        >
          {Array.from(routeMap.keys()).map((tokenMint) => {
            return (
              <option key={tokenMint} value={tokenMint}>
                {tokenMap.get(tokenMint)?.name || "unknown"}
              </option>
            );
          })}
        </select>
      </div>

      <div className="mb-2">
        <label htmlFor="outputMint" className="block text-sm font-medium">
          Output token
        </label>
        <select
          id="outputMint"
          name="outputMint"
          className="mt-1 bg-neutral block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          value={formValue.outputMint?.toBase58()}
          onChange={(e) => {
            const pbKey = new PublicKey(e.currentTarget.value);
            if (pbKey) {
              setFormValue((val) => ({
                ...val,
                outputMint: pbKey,
              }));
            }
          }}
        >
          {validOutputMints.map((tokenMint) => {
            return (
              <option key={tokenMint} value={tokenMint}>
                {tokenMap.get(tokenMint)?.name || "unknown"}
              </option>
            );
          })}
        </select>
      </div>

      <div>
        <label htmlFor="amount" className="block text-sm font-medium">
          Input Amount ({inputTokenInfo?.symbol})
        </label>
        <div className="mt-1">
          <input
            name="amount"
            id="amount"
            className="shadow-sm bg-neutral p-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
            value={formValue.amount}
            type="text"
            pattern="[0-9]*"
            onInput={(e: any) => {
              let newValue = Number(e.target?.value || 0);
              newValue = Number.isNaN(newValue) ? 0 : newValue;
              setFormValue((val) => ({
                ...val,
                amount: Math.max(newValue, 0),
              }));
            }}
          />
        </div>
      </div>

      <div className="flex justify-center">
        <button
          className={`${
            isLoading ? "opacity-50 cursor-not-allowed" : ""
          } inline-flex items-center px-4 py-2 mt-4 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
          type="button"
          onClick={fetchRoute}
          disabled={isLoading}
        >
          {isLoading && (
            <div
              className={`${styles.loader} mr-4 ease-linear rounded-full border-8 border-t-8 border-gray-200 h-24 w-24`}
            ></div>
          )}
          Refresh rate
        </button>
      </div>

      <div>Total routes: {routes?.length}</div>

      {routes?.[0] &&
        (() => {
          const route = routes[0];
          if (route) {
            return (
              <div>
                <div>
                  Best route info :{" "}
                  {route.marketInfos?.map((info) => info.label)}
                </div>
                <div>
                  Output:{" "}
                  {(route.outAmount || 0) /
                    10 ** (outputTokenInfo?.decimals || 1)}{" "}
                  {outputTokenInfo?.symbol}
                </div>
              </div>
            );
          }
        })()}

      <div className="flex justify-center mt-4">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={async () => {
            try {
              if (
                !isLoading &&
                routes?.[0] &&
                wallet.publicKey &&
                wallet.signAllTransactions
              ) {
                setIsSubmitting(true);

                const {
                  swapTransaction,
                  setupTransaction,
                  cleanupTransaction,
                } = await api.v1SwapPost({
                  body: {
                    route: routes[0],
                    userPublicKey: wallet.publicKey.toBase58(),
                  },
                });
                const transactions = (
                  [
                    setupTransaction,
                    swapTransaction,
                    cleanupTransaction,
                  ].filter(Boolean) as string[]
                ).map((tx) => {
                  return Transaction.from(Buffer.from(tx, "base64"));
                });

                await wallet.signAllTransactions(transactions);
                for (let transaction of transactions) {
                  // get transaction object from serialized transaction

                  // perform the swap
                  const txid = await connection.sendRawTransaction(
                    transaction.serialize()
                  );

                  await connection.confirmTransaction(txid);
                  console.log(`https://solscan.io/tx/${txid}`);
                }
              }
            } catch (e) {
              console.error(e);
            }
            setIsSubmitting(false);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {isSubmitting ? "Swapping.." : "Swap Best Route"}
        </button>
      </div>
    </div>
  );
};

export default JupiterForm;
