import React, {RefObject, SyntheticEvent, useEffect, useMemo, useRef, useState} from "react";

import type {
    AutocompleteInputChangeReason,
    AutocompleteProps,
    AutocompleteRenderInputParams
} from '@mui/material/Autocomplete';
import {AuthenticationResult, IPublicClientApplication, AccountInfo} from "@azure/msal-browser";
import {Autocomplete, CircularProgress, TextField, TextFieldProps} from "@mui/material";
import MapsSearch, {MapsSearchClient} from "@azure-rest/maps-search";
import {TokenCredential} from "@azure/core-auth";

type AutocompleteOption = { label: string; value: any } | string;

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

/**
 * Props for the AddressAutoComplete component
 */
export interface AddressAutoCompleteProps {
    /** Callback function when an address is selected */
    onSelect?: (feature: AzureMapsAutocompleteFeature | null) => void;
    /** Azure Maps Client ID */
    azureMapsClientId?: string;
    /** MSAL Instance for Using Application */
    msalInstance: IPublicClientApplication;
    /** Props applied to the underlying MUI Autocomplete component */
    autocompleteProps?: Partial<AutocompleteProps<AutocompleteOption, false, false, true>>;
    /** Props applied to the underlying MUI TextField component */
    textFieldProps?: Partial<TextFieldProps>;
    /** Default Bias Coordinates */
    defaultBiasCoordinates?: [number, number];
    /** Country, Default is 'US' */
    countryRegion?: string;
    /** Number of suggestions to display, Default is 5 */
    numberOfSuggestions?: number;
    /** API Version */
    apiVersion?: string;
}

export function AddressAutoComplete({ onSelect, azureMapsClientId, msalInstance, autocompleteProps, textFieldProps, defaultBiasCoordinates, countryRegion = 'US', numberOfSuggestions = 5, apiVersion = "2026-06-01-preview" }: AddressAutoCompleteProps): React.JSX.Element {
    const [inputValue, setInputValue] = useState('');
    const [options, setOptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedOption, setSelectedOption] = useState<any | null>(null);
    const [userCoordinates, setUserCoordinates] = useState<[number, number] | undefined>(defaultBiasCoordinates);
    const cache: RefObject<Record<string, any[]>> = useRef<Record<string, any[]>>({});

    useEffect((): void => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position: GeolocationPosition): void => {
                    setUserCoordinates([position.coords.longitude, position.coords.latitude]);
                },
                (error: GeolocationPositionError): void => {
                    console.warn('Geolocation error or denied:', error);
                }
            );
        }
    }, []);

    const tokenCredential: TokenCredential = useMemo<TokenCredential>(() => ({
        getToken: async () => {
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
        }
    }), [msalInstance]);

    const client: MapsSearchClient | null = useMemo((): MapsSearchClient | null => {
        if (!azureMapsClientId) return null;
        return MapsSearch(tokenCredential, azureMapsClientId, {
            apiVersion: apiVersion
        });
    }, [tokenCredential, azureMapsClientId, apiVersion]);


    useEffect((): void => {
        if (textFieldProps?.value !== undefined && typeof textFieldProps.value === 'string' && textFieldProps.value !== inputValue) {
            setInputValue(textFieldProps.value);
        }
    }, [textFieldProps?.value]);


    useEffect((): ((() => void) | undefined) => {
        if (!inputValue || !client) {
            setOptions([]);
            return;
        }

        const hasMinLength: boolean = inputValue.trim().length >= 3;
        const hasEnoughLetters: boolean = (inputValue.match(/[a-zA-Z]/g)?.length ?? 0) >= 2;

        if (!hasMinLength || !hasEnoughLetters) {
            setOptions([]);
            return;
        }

        const controller = new AbortController();

        const fetchSuggestions: () => Promise<void> = async (): Promise<void> => {
            if (cache.current[inputValue]) {
                setOptions(cache.current[inputValue]);
                return;
            }

            setLoading(true);
            try {
                const response: any = await client.path('/geocode:autocomplete' as any).get({
                    queryParameters: {
                        query: inputValue,
                        ...(userCoordinates && { coordinates: userCoordinates }),
                        countryRegion: countryRegion,
                        resultTypeGroups: ['Address'],
                        top: numberOfSuggestions
                    },
                    abortSignal: controller.signal
                });

                const data = JSON.parse(response.body) as AzureMapsAutocompleteResponse;

                const options = data.features.map((feature: AzureMapsAutocompleteFeature) => ({
                    label: feature.properties.address.formattedAddress,
                    value: feature
                }));

                cache.current[inputValue] = options;
                setOptions(options);
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error('Azure Maps search error', err);
                }
            } finally {
                setLoading(false);
            }
        };

        const timeout: number = setTimeout(fetchSuggestions, 300);

        return (): void => {
            controller.abort();
            clearTimeout(timeout);
        };
    }, [inputValue, client, userCoordinates]);

    const handleSelect = (
        _: React.SyntheticEvent,
        value: AutocompleteOption | null
    ): void => {
        let finalValue: string = '';

        if (typeof value === 'string') {
            finalValue = value;
            onSelect?.(null);
            setSelectedOption(null);
        } else if (value && value.value) {
            setSelectedOption(value);
            finalValue = value.label;
            onSelect?.(value.value);
        } else {
            setSelectedOption(null);
            onSelect?.(null);
        }

        setInputValue(finalValue);

        if (textFieldProps?.onChange)
            textFieldProps.onChange({
                target: { value: finalValue, name: textFieldProps.name }
            } as React.ChangeEvent<HTMLInputElement>);
    };


    return (
        <Autocomplete<AutocompleteOption, false, false, true>
            {...autocompleteProps}
            getOptionLabel={(option: AutocompleteOption): string =>
                typeof option === 'string' ? option : option.label
            }
            isOptionEqualToValue={(option: AutocompleteOption, value: AutocompleteOption): boolean =>
                (typeof option !== 'string' && typeof value !== 'string')
                    ? option.value.properties.address.formattedAddress === value.value.properties.address.formattedAddress
                    : option === value
            }
            filterOptions={(x: AutocompleteOption[]): AutocompleteOption[] => x}
            fullWidth
            freeSolo
            options={options}
            loading={loading}
            value={selectedOption}
            inputValue={inputValue}
            onChange={handleSelect}
            onInputChange={(event: SyntheticEvent, value: string, reason: AutocompleteInputChangeReason): void => {
                if (reason === 'input' || reason === 'clear') setInputValue(value);


                autocompleteProps?.onInputChange?.(event, value, reason);
                if (reason === 'input' && textFieldProps?.onChange)
                    textFieldProps.onChange({
                        target: { value, name: textFieldProps.name }
                    } as React.ChangeEvent<HTMLInputElement>);
            }}

            renderInput={(params: AutocompleteRenderInputParams): React.JSX.Element => (
                <TextField
                    {...params}
                    {...textFieldProps}
                    slotProps={{
                        ...textFieldProps?.slotProps,
                        input: {
                            ...params.InputProps,
                            ...textFieldProps?.slotProps?.input,
                            endAdornment: (
                                <>
                                    {loading ? <CircularProgress color="inherit" size={20} /> : null}
                                    {params.InputProps.endAdornment}
                                </>
                            )
                        }
                    }}
                />
            )}
        />
    );
}
