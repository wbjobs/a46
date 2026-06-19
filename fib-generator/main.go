package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"math/big"
	"os"
)

type Mapping struct {
	Number string `json:"number"`
	Letter string `json:"letter"`
}

func generateFibMappings(count int) []Mapping {
	mappings := make([]Mapping, 0, count)
	
	a := big.NewInt(1)
	b := big.NewInt(1)
	c := big.NewInt(0)
	
	letterIndex := 0
	maxLetters := 26
	
	for len(mappings) < count {
		c.Set(a)
		c.Add(c, b)
		a.Set(b)
		b.Set(c)
		
		if letterIndex < maxLetters {
			letter := string(rune('A' + letterIndex))
			mappings = append(mappings, Mapping{
				Number: c.String(),
				Letter: letter,
			})
			letterIndex++
		} else {
			break
		}
	}
	
	return mappings
}

func printMappings(mappings []Mapping, format string) {
	switch format {
	case "json":
		data, err := json.MarshalIndent(mappings, "", "  ")
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error marshaling JSON: %v\n", err)
			os.Exit(1)
		}
		fmt.Println(string(data))
	case "table":
		fmt.Printf("%-15s %s\n", "NUMBER", "LETTER")
		fmt.Println("---------------------")
		for _, m := range mappings {
			fmt.Printf("%-15s %s\n", m.Number, m.Letter)
		}
	default:
		fmt.Fprintf(os.Stderr, "Unknown format: %s\n", format)
		os.Exit(1)
	}
}

func saveToFile(mappings []Mapping, filename string) error {
	data, err := json.MarshalIndent(mappings, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filename, data, 0644)
}

func main() {
	count := flag.Int("count", 26, "Number of mappings to generate (max 26)")
	format := flag.String("format", "json", "Output format: json or table")
	output := flag.String("output", "", "Output file path (optional)")
	flag.Parse()

	if *count > 26 {
		fmt.Fprintln(os.Stderr, "Warning: Maximum 26 mappings (A-Z), setting count to 26")
		*count = 26
	}

	mappings := generateFibMappings(*count)

	if *output != "" {
		err := saveToFile(mappings, *output)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error saving to file: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("Mappings saved to %s\n", *output)
	} else {
		printMappings(mappings, *format)
	}
}
