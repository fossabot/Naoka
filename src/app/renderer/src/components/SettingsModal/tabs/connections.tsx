"use client";

import { Header, Separator, Setting } from "../components";
import Tooltip from "@/components/Tooltip";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { XMarkIcon } from "@heroicons/react/24/outline";
import FormModal from "@/components/FormModal";
import React from "react";
import { CheckCircleIcon } from "@heroicons/react/20/solid";
import { notify } from "@/lib/notifications";
import { ProviderAPI, providers } from "@/lib/providers";
import { ExternalAccount, ImportMethod, MediaType } from "@/lib/db/types";

export default function Connections() {
    const accounts = useLiveQuery(() => db.externalAccounts.toArray());

    return (
        <>
            <Header
                title="Connections"
                subtitle="Syncronize your library with external accounts."
            />
            <div className="bg-yellow-400/20 border border-yellow-400/50 rounded p-2 text-sm text-yellow-400">
                <div>
                    Automatic syncing and list exporting are not yet supported.
                    They'll be added in the future, so stay tuned!
                </div>
            </div>
            <Setting
                title="Link a new account"
                orientation="vertical"
                info="More sites will be added in the future."
            >
                <div className="flex flex-row flex-wrap gap-2 -mb-2">
                    {Object.getOwnPropertyNames(providers).map(
                        (key: string, index: number) => (
                            <ProviderButton
                                key={index}
                                code={key as keyof typeof providers}
                                checked={
                                    accounts
                                        ? accounts.filter(
                                              (account: ExternalAccount) =>
                                                  account.provider === key &&
                                                  account.user
                                          ).length > 0
                                        : false
                                }
                            />
                        )
                    )}
                </div>
            </Setting>
            <Separator />
            <div className="flex flex-col items-stretch gap-4 flex-1">
                {!!accounts && accounts?.length > 0 ? (
                    accounts.map((account) => (
                        <Account key={account.id} account={account} />
                    ))
                ) : (
                    <div className="flex-1 flex flex-col justify-center items-center text-zinc-300 text-base p-4 rounded-lg bg-zinc-850">
                        <div className="mb-1">(⊙.☉)7</div>
                        <div>And my connected accounts?</div>
                        <div className="opacity-50 text-sm">
                            Link an external account to import lists!
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

function ProviderButton({
    code,
    checked,
}: {
    code: keyof typeof providers;
    checked: boolean;
}) {
    const provider = providers[code];

    return (
        <Tooltip label={provider.name} position="top" spacing={0.5}>
            <button
                onClick={async () => {
                    await db.externalAccounts.add(
                        ExternalAccount.create({
                            provider: code,
                        })
                    );
                }}
                className="hover:scale-105 active:scale-110 transition-all ease-out relative"
            >
                <img
                    src={`/providers/${code}/icon.png`}
                    className="h-8 w-8 object-cover object-center rounded"
                />
                {checked && (
                    <CheckCircleIcon className="h-4 w-4 absolute -top-2 -right-2 fill-green-400" />
                )}
            </button>
        </Tooltip>
    );
}

function Account({ account }: { account: ExternalAccount }) {
    const api = new ProviderAPI(account.provider);

    const [isConnectAccountModalOpen, setIsConnectAccountModalOpen] =
        React.useState(false);
    const [
        isSelectListTypeImportModalOpen,
        setIsSelectListTypeImportModalOpen,
    ] = React.useState(false);

    function Button({
        children,
        ...props
    }: {
        children: React.ReactNode;
        [key: string]: any;
    }) {
        return (
            <button
                className="leading-none text-sm p-2 rounded bg-zinc-700/50 hover:bg-zinc-600/50 transition text-zinc-300 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-zinc-700/50"
                {...props}
            >
                {children}
            </button>
        );
    }

    return (
        <>
            <div className="rounded overflow-hidden">
                <div className="flex flex-row items-center justify-between p-2 leading-none bg-zinc-900">
                    <div className="flex flex-row items-center gap-4">
                        <img
                            src={`/providers/${String(account.provider)}/icon.png`}
                            className="rounded h-6 w-6 object-center object-cover"
                        />
                        <div className="text-zinc-300">
                            {account.user?.name ||
                                account.auth?.username ||
                                api.name}
                        </div>
                    </div>
                    <button
                        className="p-2 -m-2"
                        onClick={async () => {
                            await db.externalAccounts.delete(account.id!);
                        }}
                    >
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                </div>
                <div className="bg-zinc-850 p-2">
                    <div className="flex flex-row items-center justify-between text-sm leading-none gap-4">
                        <div className="flex flex-row items-center gap-2">
                            <Button
                                onClick={() => {
                                    setIsConnectAccountModalOpen(true);
                                }}
                            >
                                {account.auth?.username
                                    ? "Reconnect"
                                    : "Connect"}
                            </Button>
                        </div>
                        <div className="flex flex-row items-center gap-2">
                            <Button
                                disabled={
                                    !account.auth?.username ||
                                    api.config.syncing?.import?.mediaTypes.length === 0
                                }
                                onClick={(e: any) => {
                                    if (e.target.disabled) return;
                                    setIsSelectListTypeImportModalOpen(true);
                                }}
                            >
                                Import
                            </Button>
                            <Button disabled={true}>Export</Button>
                        </div>
                    </div>
                </div>
            </div>
            <FormModal
                isOpen={isConnectAccountModalOpen}
                closeModal={() => setIsConnectAccountModalOpen(false)}
                title={"Connect to " + api.name}
                subtitle={"Link your account to import your lists"}
                fields={[
                    {
                        name: "username",
                        label: "Username",
                        type: "text",
                        defaultValue: account.auth?.username || "",
                    },
                ]}
                onSubmit={({ username }) => {
                    const oldAuth = account.auth;
                    const newAuth = {
                        ...(oldAuth || {}),
                        username,
                    };

                    db.externalAccounts
                        .update(account.id!, {
                            auth: newAuth,
                        })
                        .then(() => {
                            account.auth = newAuth;
                            api.getUser(account)
                                .then((user) => {
                                    db.externalAccounts.update(account.id!, {
                                        user,
                                    });
                                })
                                .catch((e) => {
                                    // Revert changes
                                    db.externalAccounts.update(account.id!, {
                                        auth: oldAuth,
                                    });
                                });
                        });
                }}
            />
            <FormModal
                isOpen={isSelectListTypeImportModalOpen}
                closeModal={() => setIsSelectListTypeImportModalOpen(false)}
                title="Select the list to import"
                subtitle={`Select your list from ${api.name}`}
                fields={[
                    {
                        type: "radiogroup",
                        name: "type",
                        defaultValue: "anime",
                        options: [
                            ...(api.config.syncing?.import?.mediaTypes.includes("anime")
                                ? [
                                      {
                                          value: "anime",
                                          title: "Anime list",
                                          description: `Import your anime list from ${api.name}`,
                                      },
                                  ]
                                : []),
                            ...(api.config.syncing?.import?.mediaTypes.includes("manga")
                                ? [
                                      {
                                          value: "manga",
                                          title: "Manga list",
                                          description: `Import your manga list from ${api.name}`,
                                      },
                                  ]
                                : []),
                        ],
                    },
                    { type: "separator" },
                    {
                        type: "radiogroup",
                        name: "method",
                        defaultValue: "merge",
                        options: [
                            {
                                value: "override",
                                title: "Override local entries",
                                description:
                                    "If an entry conflicts, override the local one.",
                            },
                            {
                                value: "keep",
                                title: "Keep local entries",
                                description: "If an entry conflicts, keep the local one.",
                            },
                            {
                                value: "latest",
                                title: "Keep the last updated entry (recommended)",
                                description: "If an entry conflicts, keep the latest one."
                            }
                        ],
                    },
                ]}
                onSubmit={({ type, method }) => {
                    account.importLibrary(type as MediaType, method as ImportMethod).then(() => {
                        notify({
                            title: `Imported ${
                                account.user!.name
                            }'s ${type} list`,
                            body: `Your list has been successfully imported from ${api.name}.`,
                        });
                    }).catch((e) => {
                        console.error(e);
                        notify({
                            title: `Oops! Your ${api.name} library couldn't be imported`,
                            body: `Please try again later.`,
                        })
                    })
                }}
            />
        </>
    );
}
