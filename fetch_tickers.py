import urllib.request
import json
import csv
import io

def fetch_data():
    stocks = []
    
    # Nasdaq
    try:
        url = "https://pkgstore.datahub.io/core/nasdaq-listings/nasdaq-listed_csv/data/7665719fb51081ba0bd834fde71ce822/nasdaq-listed_csv.csv"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            content = response.read().decode('utf-8')
            reader = csv.reader(io.StringIO(content))
            next(reader) # skip header
            for row in reader:
                stocks.append({"symbol": row[0], "name": row[1]})
    except Exception as e:
        print("Nasdaq error:", e)

    # NYSE
    try:
        url = "https://pkgstore.datahub.io/core/nyse-other-listings/nyse-listed_csv/data/3c88fab8ec158c3cd55145243fe5fcdf/nyse-listed_csv.csv"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            content = response.read().decode('utf-8')
            reader = csv.reader(io.StringIO(content))
            next(reader) # skip header
            for row in reader:
                stocks.append({"symbol": row[0], "name": row[1]})
    except Exception as e:
        print("NYSE error:", e)
        
    # Popular ETFs and EU Stocks (VUSA, etc)
    extra_stocks = [
        {"symbol": "VUSA.AS", "name": "Vanguard S&P 500 UCITS ETF (Amsterdam)"},
        {"symbol": "VUSA.L", "name": "Vanguard S&P 500 UCITS ETF (London)"},
        {"symbol": "VWCE.DE", "name": "Vanguard FTSE All-World UCITS ETF"},
        {"symbol": "VUAA.L", "name": "Vanguard S&P 500 UCITS ETF (Acc)"},
        {"symbol": "IWDA.AS", "name": "iShares Core MSCI World UCITS ETF"},
        {"symbol": "EUNL.DE", "name": "iShares Core MSCI World UCITS ETF (DE)"},
        {"symbol": "QDVE.DE", "name": "iShares S&P 500 Information Technology Sector UCITS ETF"},
        {"symbol": "SPY", "name": "SPDR S&P 500 ETF Trust"},
        {"symbol": "QQQ", "name": "Invesco QQQ Trust"},
        {"symbol": "VOO", "name": "Vanguard S&P 500 ETF"},
        {"symbol": "VTI", "name": "Vanguard Total Stock Market ETF"},
        {"symbol": "ARKK", "name": "ARK Innovation ETF"}
    ]
    stocks.extend(extra_stocks)
    
    # Remove duplicates based on symbol
    unique_stocks = []
    seen = set()
    for s in stocks:
        if s["symbol"] not in seen:
            seen.add(s["symbol"])
            unique_stocks.append(s)
            
    print(f"Total unique stocks: {len(unique_stocks)}")
    
    js_content = f"export const STOCK_DICTIONARY = {json.dumps(unique_stocks)};\n\n"
    js_content += """
export function getLocalSuggestions(query) {
  if (!query || query.trim().length === 0) return [];
  const lowerQuery = query.toLowerCase().trim();
  
  return STOCK_DICTIONARY.filter(stock => 
    stock.symbol.toLowerCase().includes(lowerQuery) || 
    stock.name.toLowerCase().includes(lowerQuery)
  ).slice(0, 8); // Max 8 results
}
"""
    
    with open("/mnt/ramdisk/stock-frontend/src/utils/stockDictionary.js", "w") as f:
        f.write(js_content)
        
if __name__ == "__main__":
    fetch_data()
