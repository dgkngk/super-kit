---
description: Run Xcode tests for iOS applications. Use for iOS app testing.
---

# /xcode-test - iOS Testing

Run Xcode tests for iOS application testing.

## Prerequisites

- Xcode installed
- iOS project with test targets

## Workflow

### Step 0: Check Testing Skill

For unified testing patterns and templates, refer to the testing skill:

```bash
// turbo
Call MCP `call_tool_logger_manager` { action: "logWorkflow", name: "/xcode-test", outcome: "success" }
Call MCP `call_tool_compound_manager` { action: "search", terms: [ "ios testing"] }
```
cat skills/testing/SKILL.md
Call MCP `call_tool_logger_manager` { action: "logSkill", name: "testing", outcome: "workflow" }
```

### Step 1: Run Tests

```bash
# Run all tests
xcodebuild test \
  -scheme YourScheme \
  -destination 'platform=iOS Simulator,name=iPhone 15'

# Run specific test class
xcodebuild test \
  -scheme YourScheme \
  -destination 'platform=iOS Simulator,name=iPhone 15' \
  -only-testing:YourTests/TestClass

# Run with coverage
xcodebuild test \
  -scheme YourScheme \
  -destination 'platform=iOS Simulator,name=iPhone 15' \
  -enableCodeCoverage YES
```

### Step 2: View Results

```bash
# View test results
xcrun xcresulttool get --path TestResults.xcresult

# Generate coverage report
xcrun xccov view --report TestResults.xcresult
```

### Step 3: Debug Failures

- Check test logs in Xcode
- Run individual failing tests
- Use breakpoints in test methods

### Phase 5: Completion & Handoff

#### Step 1: Establish Terminal UI State

```javascript
await task_boundary({
  TaskName: "[COMPLETED] iOS Tests",
  TaskStatus: "Tests executed. Offering next steps.",
  Mode: "VERIFICATION",
  TaskSummary: "Executed tests for {Scheme}. Result: {Pass/Fail}. Coverage report generated."
});
```

#### Step 2: Mandatory Handoff

```bash
✓ Tests complete

Next steps:
1. /work - Fix failures
2. /report-bug - File issues for failures
```

---

## References

- Docs: https://developer.apple.com/documentation/xcode/testing
