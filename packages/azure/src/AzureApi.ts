import type { MapsSearchClient as MapsSearchClientType } from "@azure-rest/maps-search";
import type { AddressFetcher, FetcherOptions } from "@jt122406/address-autocomplete-common";
import type { AccessToken, TokenCredential } from "@azure/core-auth";
import type {AccountInfo, AuthenticationResult, IPublicClientApplication} from "@azure/msal-browser";
import type { AzureMapsAutocompleteFeature, AzureMapsAutocompleteResponse } from "./types";
import MapsSearch from "@azure-rest/maps-search";

const createMsalCredential: (msalInstance: IPublicClientApplication) => TokenCredential = (msalInstance: IPublicClientApplication): TokenCredential => ({
    getToken: async (): Promise<AccessToken | null> => {
        const accounts: AccountInfo[] = msalInstance.getAllAccounts();

        if (accounts.length === 0) throw new Error('No active account');

        const response: AuthenticationResult = await msalInstance.acquireTokenSilent({
            scopes: ['https://atlas.microsoft.com/.default'],
            account: accounts[0]
        });

        return {
            token: response.accessToken,
            expiresOnTimestamp: response.expiresOn?.getTime() ?? Date.now() + 3600 * 1000
        };
    },
});

export const makeClient = (msalInstance: IPublicClientApplication, azureMapsClientId: string, apiVersion: string = "2022-05-31"): AddressFetcher<AzureMapsAutocompleteFeature> => {
    const credential: TokenCredential = createMsalCredential(msalInstance);
    const client: MapsSearchClientType = MapsSearch(credential, azureMapsClientId, {
        apiVersion: apiVersion
    });

    return createAzureFetcher(client);
};

/**
 * Creates an AddressFetcher for Azure Maps.
 *
 * @param client - An instance of MapsSearchClient from @azure-rest/maps-search
 * @returns An AddressFetcher function
 */
export const createAzureFetcher: (client: MapsSearchClientType) => AddressFetcher<AzureMapsAutocompleteFeature> = (client: MapsSearchClientType): AddressFetcher<AzureMapsAutocompleteFeature> => {
    return async (query: string, options?: FetcherOptions): Promise<AzureMapsAutocompleteFeature[]> => {
        try {
            const response: any = await client.path("/geocode:autocomplete" as any).get({
                queryParameters: {
                    query,
                    ...(options?.coordinates && { coordinates: options.coordinates }),
                    countryRegion: options?.countryRegion || "US",
                    resultTypeGroups: ["Address"],
                    top: options?.limit || 5,
                },
                abortSignal: options?.signal,
            });

            const data = JSON.parse(response.body) as AzureMapsAutocompleteResponse;

            return data.features;
        } catch (e) {
            console.error(e);
            return [];
        }
    };
};