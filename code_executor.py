"""Code execution module for handling multiple programming languages."""

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

# Get the project root directory (where this file is located)
PROJECT_ROOT = Path(__file__).resolve().parent


class CodeExecutor:
    """Execute code in multiple programming languages."""

    # Language configurations: (file_extension, compile_command, run_command)
    LANGUAGE_CONFIG = {
        "cpp23": {
            "extension": ".cpp",
            "compile": ["g++", "-o", "{output}", "{source}", "-std=c++23", "-I{project_root}"],
            "run": ["{output}"],
        },
        "cpp20": {
            "extension": ".cpp",
            "compile": ["g++", "-o", "{output}", "{source}", "-std=c++20", "-I{project_root}"],
            "run": ["{output}"],
        },
        "cpp17": {
            "extension": ".cpp",
            "compile": ["g++", "-o", "{output}", "{source}", "-std=c++17", "-I{project_root}"],
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
            "run": ["java", "-cp", "{work_dir}", "Solution"],
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
    def _resolve_runtime_command(binary: str) -> str:
        """Resolve a runtime/compiler binary in a Windows-friendly way."""
        candidates = [binary]
        if binary == "python3":
            candidates = ["python3", "python"]
        elif binary == "g++":
            candidates = ["g++", "c++"]

        for candidate in candidates:
            resolved = shutil.which(candidate)
            if resolved:
                return resolved
        return binary

    @staticmethod
    def _resolve_output_path(output_file: Path) -> Path:
        """Use a platform-appropriate executable name."""
        if os.name == "nt":
            return output_file.with_suffix(".exe")
        return output_file

    @staticmethod
    def _prepare_command(args: list[str], source_file: Path, output_file: Path, work_dir: str) -> list[str]:
        resolved_output = CodeExecutor._resolve_output_path(output_file)
        cmd = [
            arg.format(
                source=str(source_file),
                output=str(resolved_output),
                work_dir=work_dir,
                project_root=str(PROJECT_ROOT),
            )
            for arg in args
        ]
        if cmd:
            cmd[0] = CodeExecutor._resolve_runtime_command(cmd[0])
        return cmd

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
            
            # For Java, use Solution as class name
            if language == "java":
                source_file = work_path / "Solution.java"
                # Replace public class definitions with Solution
                code = code.replace("public class Main", "public class Solution")
                code = code.replace("class Main", "public class Solution")
            else:
                source_file = work_path / f"solution{config['extension']}"
            
            output_file = work_path / "solution"
            # Write source code
            source_file.write_text(code)

            # Compile if needed
            if config["compile"]:
                compile_cmd = CodeExecutor._prepare_command(config["compile"], source_file, output_file, work_dir)
                try:
                    result = subprocess.run(
                        compile_cmd,
                        timeout=timeout,
                        capture_output=True,
                        text=True,
                        cwd=work_dir,
                    )
                    if result.returncode != 0:
                        error_msg = result.stderr or result.stdout or "Compilation failed"
                        return {"error": f"Compilation error: {error_msg[:200]}"}
                except subprocess.TimeoutExpired:
                    return {"error": "Compilation timeout"}
                except FileNotFoundError as e:
                    return {"error": f"Required compiler/runtime not found: {compile_cmd[0]}"}
                except Exception as e:
                    return {"error": f"Compilation error: {str(e)[:200]}"}

            # Run test cases
            results = []
            passed_count = 0

            for test_case in test_cases:
                try:
                    test_input = test_case.get("input", "")
                    expected_output = test_case.get("expectedOutput", "").strip()
                    test_index = test_case.get("index", len(results) + 1)

                    run_cmd = CodeExecutor._prepare_command(config["run"], source_file, output_file, work_dir)

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
                except FileNotFoundError as e:
                    results.append(
                        {
                            "test_index": test_case.get("index", len(results) + 1),
                            "passed": False,
                            "expected_output": test_case.get("expectedOutput", ""),
                            "actual_output": f"Runtime Error: required runtime not found ({run_cmd[0]})",
                        }
                    )
                except Exception as e:
                    results.append(
                        {
                            "test_index": test_case.get("index", len(results) + 1),
                            "passed": False,
                            "expected_output": test_case.get("expectedOutput", ""),
                            "actual_output": f"Runtime Error: {str(e)[:200]}",
                        }
                    )

            return {
                "results": results,
                "passed_count": passed_count,
                "total_count": len(results),
            }
