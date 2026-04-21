import type {AddressFetcher, AutocompleteOption, FetcherOptions} from "@jt122406/address-autocomplete-common";
import {
    AutocompleteCommand,
    AutocompleteCommandInput,
    AutocompleteCommandOutput,
    AutocompleteResultItem,
    GeoPlacesClient
} from "@aws-sdk/client-geo-places";
import {fromCognitoIdentityPool} from "@aws-sdk/credential-providers";

export const makeClient: (identityPoolId: string, region?: string) => AddressFetcher = (identityPoolId: string, region: string = "us-east-1"): AddressFetcher => {
    const client = new GeoPlacesClient({
        region,
        credentials: fromCognitoIdentityPool({
            identityPoolId,
        }),
    });
    return createAwsFetcher(client);
};

/**
 * Creates an AddressFetcher for AWS Geo Places.
 * @param client - An instance of GeoPlacesClient from @aws-sdk/client-geo-places
 */
export const createAwsFetcher: (client: GeoPlacesClient) => AddressFetcher = (client: GeoPlacesClient): AddressFetcher => {
    return async (query: string, options?: FetcherOptions): Promise<AutocompleteOption[]> => {
        try {
            const input: AutocompleteCommandInput = {
                QueryText: query,
                MaxResults: options?.limit || 5,
                ...(options?.coordinates && {
                    BiasPosition: [options.coordinates[1], options.coordinates[0]]
                }),
                Filter: {
                    IncludeCountries: options?.countryRegion ? [options.countryRegion] : ["USA"],
                    IncludePlaceTypes: ["Locality", "PostalCode"]
                },
                AdditionalFeatures: ["Core"]
            };

            const command = new AutocompleteCommand(input);
            const response: AutocompleteCommandOutput = await client.send(command);

            if (!response.ResultItems) {
                return [];
            }

            return response.ResultItems.map((item: AutocompleteResultItem): AutocompleteOption => ({
                label: item.Address?.Label || "",
                value: item
            }));
        } catch (e) {
            console.error("AWS GeoPlaces Error:", e);
            return [];
        }
    };
};