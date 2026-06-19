package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"math/big"
	"os"
	"strings"
)

type Mapping struct {
	Number string `json:"number"`
	Letter string `json:"letter"`
}

type DaemonRequest struct {
	Command string   `json:"command"`
	Numbers []string `json:"numbers,omitempty"`
	Letters []string `json:"letters,omitempty"`
	Count   int      `json:"count,omitempty"`
	ID      string   `json:"id,omitempty"`
}

type DaemonResponse struct {
	Success bool              `json:"success"`
	Command string            `json:"command"`
	Mapping map[string]string `json:"mapping,omitempty"`
	Results map[string]string `json:"results,omitempty"`
	Errors  []string          `json:"errors,omitempty"`
	Message string            `json:"message,omitempty"`
	ID      string            `json:"id,omitempty"`
}

type FibGenerator struct {
	fibNumbers      []*big.Int
	mappings        map[string]string
	letterToNumber  map[string]string
	maxCount        int
}

func NewFibGenerator() *FibGenerator {
	fg := &FibGenerator{
		fibNumbers:     make([]*big.Int, 0),
		mappings:       make(map[string]string),
		letterToNumber: make(map[string]string),
		maxCount:       26,
	}
	fg.generateUpTo(26)
	return fg
}

func (fg *FibGenerator) generateUpTo(count int) {
	if count > fg.maxCount {
		fg.maxCount = count
	}

	if len(fg.fibNumbers) >= count {
		return
	}

	a := big.NewInt(1)
	b := big.NewInt(1)

	currentLen := len(fg.fibNumbers)
	if currentLen == 0 {
		c := new(big.Int).Add(a, b)
		numStr := c.String()
		fg.fibNumbers = append(fg.fibNumbers, c)
		fg.mappings[numStr] = "A"
		fg.letterToNumber["A"] = numStr
		currentLen = 1
		a.Set(b)
		b.Set(c)
	} else {
		if currentLen >= 2 {
			a = fg.fibNumbers[currentLen-2]
			b = fg.fibNumbers[currentLen-1]
		} else if currentLen == 1 {
			a = big.NewInt(1)
			b = fg.fibNumbers[0]
		}
	}

	for i := currentLen; i < count; i++ {
		c := new(big.Int).Add(a, b)
		a = b
		b = c

		numStr := c.String()
		fg.fibNumbers = append(fg.fibNumbers, c)

		if i < 26 {
			letter := string(rune('A' + i))
			fg.mappings[numStr] = letter
			fg.letterToNumber[letter] = numStr
		}
	}
}

func (fg *FibGenerator) GetAllMappings() map[string]string {
	result := make(map[string]string, len(fg.mappings))
	for k, v := range fg.mappings {
		result[k] = v
	}
	return result
}

func (fg *FibGenerator) LookupNumbers(numbers []string) (map[string]string, []string) {
	results := make(map[string]string)
	errors := make([]string, 0)

	for _, num := range numbers {
		if num == "0" {
			results[num] = " "
			continue
		}

		if letter, ok := fg.mappings[num]; ok {
			results[num] = letter
		} else {
			errors = append(errors, fmt.Sprintf("Unknown number: %s", num))
			results[num] = "?"
		}
	}

	return results, errors
}

func (fg *FibGenerator) LookupLetters(letters []string) (map[string]string, []string) {
	results := make(map[string]string)
	errors := make([]string, 0)

	for _, letter := range letters {
		if letter == " " || letter == "" {
			results[letter] = "0"
			continue
		}

		upperLetter := strings.ToUpper(letter)
		if number, ok := fg.letterToNumber[upperLetter]; ok {
			results[letter] = number
		} else {
			errors = append(errors, fmt.Sprintf("Unknown letter: %s", letter))
			results[letter] = "?"
		}
	}

	return results, errors
}

func (fg *FibGenerator) GetLetterMappings() map[string]string {
	result := make(map[string]string, len(fg.letterToNumber))
	for k, v := range fg.letterToNumber {
		result[k] = v
	}
	return result
}

func (fg *FibGenerator) GetMappingsList(count int) []Mapping {
	if count > len(fg.fibNumbers) {
		fg.generateUpTo(count)
	}

	mappings := make([]Mapping, 0, count)
	for i := 0; i < count && i < len(fg.fibNumbers); i++ {
		letter := string(rune('A' + i))
		mappings = append(mappings, Mapping{
			Number: fg.fibNumbers[i].String(),
			Letter: letter,
		})
	}
	return mappings
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

func runDaemon() {
	generator := NewFibGenerator()
	scanner := bufio.NewScanner(os.Stdin)
	writer := bufio.NewWriter(os.Stdout)

	fmt.Fprintf(os.Stderr, "Fibonacci Generator Daemon started\n")

	for scanner.Scan() {
		line := scanner.Text()
		line = strings.TrimSpace(line)

		if line == "" {
			continue
		}

		var req DaemonRequest
		if err := json.Unmarshal([]byte(line), &req); err != nil {
			resp := DaemonResponse{
				Success: false,
				Command: "unknown",
				Message: fmt.Sprintf("Invalid JSON: %v", err),
			}
			writeResponse(writer, resp)
			continue
		}

		resp := handleCommand(generator, req)
		writeResponse(writer, resp)
	}

	if err := scanner.Err(); err != nil {
		fmt.Fprintf(os.Stderr, "Read error: %v\n", err)
	}
}

func handleCommand(gen *FibGenerator, req DaemonRequest) DaemonResponse {
	resp := DaemonResponse{
		Command: req.Command,
		ID:      req.ID,
	}

	switch strings.ToUpper(req.Command) {
	case "PING":
		resp.Success = true
		resp.Message = "PONG"

	case "MAPPINGS":
		resp.Success = true
		resp.Mapping = gen.GetAllMappings()

	case "LOOKUP":
		if len(req.Numbers) == 0 {
			resp.Success = false
			resp.Message = "No numbers provided"
			return resp
		}
		results, errors := gen.LookupNumbers(req.Numbers)
		resp.Success = true
		resp.Results = results
		if len(errors) > 0 {
			resp.Errors = errors
		}

	case "DECRYPT":
		if len(req.Numbers) == 0 {
			resp.Success = false
			resp.Message = "No numbers provided"
			return resp
		}
		results, errors := gen.LookupNumbers(req.Numbers)
		resp.Success = true
		resp.Results = results
		if len(errors) > 0 {
			resp.Errors = errors
		}

	case "LOOKUP_LETTERS":
		if len(req.Letters) == 0 {
			resp.Success = false
			resp.Message = "No letters provided"
			return resp
		}
		results, errors := gen.LookupLetters(req.Letters)
		resp.Success = true
		resp.Results = results
		if len(errors) > 0 {
			resp.Errors = errors
		}

	case "ENCRYPT":
		if len(req.Letters) == 0 {
			resp.Success = false
			resp.Message = "No letters provided"
			return resp
		}
		results, errors := gen.LookupLetters(req.Letters)
		resp.Success = true
		resp.Results = results
		if len(errors) > 0 {
			resp.Errors = errors
		}

	case "GENERATE":
		count := 26
		if req.Count > 0 {
			count = req.Count
		}
		if count > 1000 {
			count = 1000
		}
		gen.generateUpTo(count)
		resp.Success = true
		resp.Message = fmt.Sprintf("Generated %d mappings", count)
		resp.Mapping = gen.GetAllMappings()

	default:
		resp.Success = false
		resp.Message = fmt.Sprintf("Unknown command: %s", req.Command)
	}

	return resp
}

func writeResponse(writer *bufio.Writer, resp DaemonResponse) {
	data, err := json.Marshal(resp)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error marshaling response: %v\n", err)
		return
	}
	writer.Write(data)
	writer.WriteByte('\n')
	writer.Flush()
}

func main() {
	daemon := flag.Bool("daemon", false, "Run in daemon mode with IPC")
	count := flag.Int("count", 26, "Number of mappings to generate (max 26)")
	format := flag.String("format", "json", "Output format: json or table")
	output := flag.String("output", "", "Output file path (optional)")
	flag.Parse()

	if *daemon {
		runDaemon()
		return
	}

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
