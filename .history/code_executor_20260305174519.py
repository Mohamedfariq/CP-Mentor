"""Code execution module for handling multiple programming languages."""

import os
import subprocess
import tempfile
from pathlib import Path


class CodeExecutor:
    """Execute code in multiple programming languages."""

    # Language configurations: (file_extension, compile_command, run_command)
    LANGUAGE_CONFIG = {
        "cpp23": {
            "extension": ".cpp",
            "compile": ["g++", "-o", "{output}", "{source}", "-std=c++23"],
            "run": ["{output}"],
        },
        "cpp20": {
            "extension": ".cpp",
            "compile": ["g++", "-o", "{output}", "{source}", "-std=c++20"],
            "run": ["{output}"],
        },
        "cpp17": {
            "extension": ".cpp",
            "compile": ["g++", "-o", "{output}", "{source}", "-std=c++17"],
            "run": ["{output}"],
        },
        "c": {
            "extension": ".c",
            "compile": ["gcc", "-o", "{output}", "{source}"],
            "run": ["{output}"],
        },
        "python3": {
            "extension": ".py",
            "compile": None,
            "run": ["python3", "{source}"],
        },
        "java": {
            "extension": ".java",
            "compile": ["javac", "{source}"],
            "run": ["java", "-cp", "{work_dir}", "Main"],
        },
        "go": {
            "extension": ".go",
            "compile": ["go", "build", "-o", "{output}", "{source}"],
            "run": ["{output}"],
        },
        "rust": {
            "extension": ".rs",
            "compile": ["rustc", "-o", "{output}", "{source}"],
            "run": ["{output}"],
        },
        "javascript": {
            "extension": ".js",
            "compile": None,
            "run": ["node", "{source}"],
        },
        "kotlin": {
            "extension": ".kt",
            "compile": ["kotlinc", "{source}", "-include-runtime", "-d", "{output}.jar"],
            "run": ["java", "-jar", "{output}.jar"],
        },
        "csharp": {
            "extension": ".cs",
            "compile": ["csc", "/out:{output}.exe", "{source}"],
            "run": ["{output}.exe"],
        },
    }

    @staticmethod
    def execute(code: str, language: str, test_cases: list, timeout: int = 4) -> dict:
        """
        Execute code with test cases.

        Args:
            code: Source code to execute
            language: Programming language
            test_cases: List of dicts with 'input', 'expectedOutput', 'index'
            timeout: Execution timeout in seconds

        Returns:
            dict with 'results', 'passed_count', 'total_count', 'error' (if any)
        """
        if language not in CodeExecutor.LANGUAGE_CONFIG:
            return {"error": f"Language '{language}' not supported"}

        config = CodeExecutor.LANGUAGE_CONFIG[language]

        with tempfile.TemporaryDirectory() as work_dir:
            work_path = Path(work_dir)
            source_file = work_path / f"solution{config['extension']}"
            output_file = work_path / "solution.out"

            # Write source code
            source_file.write_text(code)

            # Compile if needed
            if config["compile"]:
                compile_cmd = [
                    arg.format(source=str(source_file), output=str(output_file), work_dir=work_dir)
                    for arg in config["compile"]
                ]
                try:
                    subprocess.run(
                        compile_cmd,
                        timeout=timeout,
                        capture_output=True,
                        text=True,
                        cwd=work_dir,
                    )
                except subprocess.TimeoutExpired:
                    return {"error": "Compilation timeout"}
                except Exception as e:
                    return {"error": f"Compilation error: {str(e)}"}

            # Run test cases
            results = []
            passed_count = 0

            for test_case in test_cases:
                try:
                    test_input = test_case.get("input", "")
                    expected_output = test_case.get("expectedOutput", "").strip()
                    test_index = test_case.get("index", len(results) + 1)

                    run_cmd = [
                        arg.format(source=str(source_file), output=str(output_file), work_dir=work_dir)
                        for arg in config["run"]
                    ]

                    result = subprocess.run(
                        run_cmd,
                        input=test_input,
                        capture_output=True,
                        text=True,
                        timeout=timeout,
                        cwd=work_dir,
                    )

                    actual_output = result.stdout.strip()
                    passed = actual_output == expected_output

                    results.append(
                        {
                            "test_index": test_index,
                            "passed": passed,
                            "expected_output": expected_output,
                            "actual_output": actual_output,
                        }
                    )

                    if passed:
                        passed_count += 1

                except subprocess.TimeoutExpired:
                    results.append(
                        {
                            "test_index": test_case.get("index", len(results) + 1),
                            "passed": False,
                            "expected_output": test_case.get("expectedOutput", ""),
                            "actual_output": "Time Limit Exceeded",
                        }
                    )
                except Exception as e:
                    results.append(
                        {
                            "test_index": test_case.get("index", len(results) + 1),
                            "passed": False,
                            "expected_output": test_case.get("expectedOutput", ""),
                            "actual_output": f"Runtime Error: {str(e)}",
                        }
                    )

            return {
                "results": results,
                "passed_count": passed_count,
                "total_count": len(results),
            }
