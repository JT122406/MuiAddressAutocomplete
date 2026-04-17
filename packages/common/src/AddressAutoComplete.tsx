import React, {RefObject, SyntheticEvent, useEffect, useRef, useState} from "react";

import type {
    AutocompleteProps,
    AutocompleteRenderInputParams
} from '@mui/material/Autocomplete';
import {Autocomplete, CircularProgress, TextField, TextFieldProps} from "@mui/material";
import {AddressFetcher} from "./types";
import type {AutocompleteOption} from "./types";

/**
 * Props for the AddressAutoComplete component
 */
export interface AddressAutoCompleteProps<T> {
    /** Callback function when an address is selected */
    onSelect?: (feature: T | null) => void;
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
    /** A fetcher function to get address suggestions */
    fetcher: AddressFetcher;
}

export function AddressAutoComplete<T>({
    onSelect,
    autocompleteProps,
    textFieldProps,
    defaultBiasCoordinates,
    countryRegion = 'US',
    numberOfSuggestions = 5,
    fetcher
}: AddressAutoCompleteProps<T>): React.JSX.Element {
    const [inputValue, setInputValue] = useState('');
    const [options, setOptions] = useState<AutocompleteOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedOption, setSelectedOption] = useState<AutocompleteOption | null>(null);
    const [userCoordinates, setUserCoordinates] = useState<[number, number] | undefined>(defaultBiasCoordinates);
    const cache: RefObject<Record<string, AutocompleteOption[]>> = useRef<Record<string, AutocompleteOption[]>>({});

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

    useEffect((): void => {
        if (textFieldProps?.value !== undefined && typeof textFieldProps.value === 'string' && textFieldProps.value !== inputValue) {
            setInputValue(textFieldProps.value);
        }
    }, [textFieldProps?.value]);


    useEffect((): ((() => void) | undefined) => {
        if (!inputValue) {
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
                const results: AutocompleteOption[] = await fetcher(inputValue, {
                    signal: controller.signal,
                    coordinates: userCoordinates,
                    countryRegion: countryRegion,
                    limit: numberOfSuggestions
                });

                cache.current[inputValue] = results;
                setOptions(results);
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error('Address search error', err);
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
    }, [inputValue, fetcher, userCoordinates, countryRegion, numberOfSuggestions]);

    const handleSelect = (_: React.SyntheticEvent, value: AutocompleteOption | null): void => {
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
                    ? option.label === value.label
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
            onInputChange={(_: SyntheticEvent, value: string, reason: string): void => {
                if (reason === 'input' || reason === 'clear') {
                    setInputValue(value);

                    if (textFieldProps?.onChange) {
                        textFieldProps.onChange({
                            target: {value, name: textFieldProps.name}
                        } as React.ChangeEvent<HTMLInputElement>);
                    }
                }
            }}
            renderInput={(params: AutocompleteRenderInputParams): React.JSX.Element => {
                const {
                    value: _v,
                    onChange: _oc,
                    slotProps: textFieldSlotProps,
                    ...otherTextFieldProps
                } = textFieldProps || {};

                const inputSlotProps: any =
                    typeof textFieldSlotProps?.input === 'function'
                        ? {}
                        : textFieldSlotProps?.input;

                return (
                    <TextField
                        {...params}
                        {...otherTextFieldProps}
                        slotProps={{
                            ...textFieldSlotProps,
                            input: {
                                ...params.slotProps,
                                ...inputSlotProps,
                                endAdornment: (
                                    <>
                                        {loading ? (
                                            <CircularProgress color="inherit" size={20} />
                                        ) : null}
                                        {params.slotProps.input.endAdornment}
                                        {inputSlotProps?.endAdornment}
                                    </>
                                )
                            }
                        }}
                    />
                );
            }}
        />
    );
}
