import type { MapsSearchClient } from "@azure-rest/maps-search";
import type { AddressFetcher, FetcherOptions } from "@jt122406/address-autocomplete-common";
import type { AzureMapsAutocompleteFeature, AzureMapsAutocompleteResponse } from "./types";

export const createAzureFetcher = (
    client: MapsSearchClient
): AddressFetcher<AzureMapsAutocompleteFeature> => {
    return async (query: string, options?: FetcherOptions) => {
        const response = await client.path('/geocode:autocomplete' as any).get({
            queryParameters: {
                query,
                ...(options?.coordinates && { coordinates: options.coordinates }),
                countryRegion: options?.countryRegion || 'US',
                resultTypeGroups: ['Address'],
                top: options?.limit || 5
            },
            abortSignal: options?.signal
        });

        const data = JSON.parse(response.body) as AzureMapsAutocompleteResponse;
        return data.features;
    };
};