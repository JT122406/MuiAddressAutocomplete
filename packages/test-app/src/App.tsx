import React, { useState } from 'react';
import { AddressAutoComplete, AddressFetcher, AutocompleteOption } from '@jt122406/address-autocomplete-common';
import { Container, Typography, Box, Paper } from '@mui/material';

// Hardcoded test addresses
const TEST_ADDRESSES: AutocompleteOption[] = [
  { label: '1600 Pennsylvania Avenue NW, Washington, DC 20500', value: { id: '1', detail: 'White House' } },
  { label: '11 Wall Street, New York, NY 10005', value: { id: '2', detail: 'NYSE' } },
  { label: '350 5th Ave, New York, NY 10118', value: { id: '3', detail: 'Empire State Building' } },
  { label: '221B Baker Street, London, UK', value: { id: '4', detail: 'Sherlock Holmes' } },
  { label: '1 Infinite Loop, Cupertino, CA 95014', value: { id: '5', detail: 'Apple HQ' } },
];

const hardcodedFetcher: AddressFetcher = async (query: string): Promise<AutocompleteOption[]> => {
  console.log('Fetching for query:', query);
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (!query) return [];
  
  return TEST_ADDRESSES.filter(option => 
    typeof option === 'string' 
      ? option.toLowerCase().includes(query.toLowerCase())
      : option.label.toLowerCase().includes(query.toLowerCase())
  );
};

function App() {
  const [selectedAddress, setSelectedAddress] = useState<any>(null);

  const handleSelect = (value: any) => {
    console.log('Selected value:', value);
    setSelectedAddress(value);
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Address Autocomplete Test
        </Typography>
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="body1" gutterBottom>
            Type to search for hardcoded addresses (e.g., "Wall", "Ave", "Baker"):
          </Typography>
          <AddressAutoComplete 
            fetcher={hardcodedFetcher} 
            onSelect={handleSelect}
            textFieldProps={{ label: 'Search Address', variant: 'outlined' }}
          />
          {selectedAddress && (
            <Box sx={{ mt: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="subtitle2">Selected Address Detail:</Typography>
              <pre>{JSON.stringify(selectedAddress, null, 2)}</pre>
            </Box>
          )}
        </Paper>
      </Box>
    </Container>
  );
}

export default App;
