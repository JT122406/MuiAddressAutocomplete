export interface AzureMapsAutocompleteFeature {
    type: 'Feature';
    properties: {
        typeGroup: string;
        type: string;
        geometry: any | null;
        address: {
            locality?: string;
            adminDistricts?: Array<{ name: string; shortName?: string }>;
            countryRegions?: { ISO: string; name: string };
            postalCode?: string;
            streetNumber?: string;
            streetName?: string;
            addressLine?: string;
            formattedAddress: string;
        };
    };
    geometry: any | null;
}

export interface AzureMapsAutocompleteResponse {
    type: 'FeatureCollection';
    features: AzureMapsAutocompleteFeature[];
}