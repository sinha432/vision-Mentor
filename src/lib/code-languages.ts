import type { CodeLanguage } from "@/lib/assessment-types";

export const CODE_STARTER_TEMPLATES: Record<CodeLanguage, string> = {
  java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        // Read input, implement the solution, and print the result.
    }
}`,
  javascript: `const fs = require("fs");
const input = fs.readFileSync(0, "utf8").trim();

// Parse input, implement the solution, and print the result.
console.log(input);`,
  python: `import sys

def solve(input_text: str) -> str:
    # Parse input, implement the solution, and return the result.
    return input_text.strip()

print(solve(sys.stdin.read()))`,
  c: `#include <stdio.h>

int main(void) {
    // Read input from stdin and write the result to stdout.
    return 0;
}`,
  cpp: `#include <iostream>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    // Read input from stdin and write the result to stdout.
    return 0;
}`,
};