export interface FetcherOptions {
    signal?: AbortSignal;
    coordinates?: [number, number];
    countryRegion?: string;
    limit?: number;
}

/**
 * A standardized fetcher type.
 * T is the raw data shape from the provider (e.g., AzureMapsAutocompleteFeature)
 */
export type AddressFetcher<T> = (
    query: string,
    options?: FetcherOptions
) => Promise<T[]>;