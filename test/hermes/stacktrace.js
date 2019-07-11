// Copyright (c) Facebook, Inc. and its affiliates.
//
// This source code is licensed under the MIT license found in the LICENSE
// file in the root directory of this source tree.
//
// RUN: %hermes -O -target=HBC -fno-inline %s | %FileCheck --match-full-lines %s

function foo() {
  function bar() {
    var anonVar = function() {
      throw new Error("helloworld");
    }
    anonVar();
  }
  bar();
}

try {
  try {
    foo();
  } finally {
    print("rethrowing");
  }
} catch (e) {
  print(e.stack);
}
//CHECK-LABEL: Error: helloworld
//CHECK-NEXT:     at anonVar ({{.*}}stacktrace.js:11:22)
//CHECK-NEXT:     at bar ({{.*}}stacktrace.js:13:12)
//CHECK-NEXT:     at foo ({{.*}}stacktrace.js:15:6)
//CHECK-NEXT:     at global ({{.*}}stacktrace.js:20:8)

try {
  Object.a();
} catch (e) {
  print(e.stack);
}
//CHECK-LABEL: TypeError: undefined is not a function
//CHECK-NEXT:     at global ({{.*}}stacktrace.js:34:11)

function throwit() { throw new Error("EvalTest"); }
try {
  eval("throwit()");
} catch (e) {
  print(e.stack);
}
//CHECK-LABEL: Error: EvalTest
//CHECK-NEXT:    at throwit ({{.*}}stacktrace.js:41:37)
//CHECK-NEXT:    at eval (JavaScript:1:8)
//CHECK-NEXT:    at global (native)

function runAndPrint(f) {
  try {
    f();
  } catch (e) {
    print(e.stack);
  }
}

// Try some native scenarios.
print("Native Scenarios");
function thrower(x) { throw new Error(x); }
runAndPrint(function() {
  [1, 2, 3].forEach(thrower);
})
//CHECK-LABEL: Native Scenarios
//CHECK-NEXT: Error: 1
//CHECK-NEXT:     at thrower ({{.*}})
//CHECK-NEXT:     at forEach (native)
//CHECK-NEXT:     at anonymous ({{.*}})

runAndPrint(function() {
  "amatchmec".replace("matchme", thrower);
})
//CHECK-LABEL: Error: matchme
//CHECK-NEXT:     at thrower ({{.*}})
//CHECK-NEXT:     at replace (native)
//CHECK-NEXT:     at anonymous ({{.*}})

runAndPrint(function() {
  Math.abs({valueOf: thrower});
})
//CHECK-LABEL: Error: undefined
//CHECK-NEXT:     at thrower ({{.*}})
//CHECK-NEXT:     at abs (native)
//CHECK-NEXT:     at anonymous ({{.*}})


// Ensure that the 'name' property is respected correctly.
var func = function original() {
  throw new Error(arguments.callee.name);
}
runAndPrint(func)
//CHECK-LABEL: Error: original
//CHECK-NEXT:    at original ({{.*}})

Object.defineProperty(func, 'name', {writable:true, value:'newname'})
print("Name is " + func.name)
runAndPrint(func)
//CHECK-LABEL: Name is newname
//CHECK-NEXT: Error: newname
//CHECK-NEXT:    at newname ({{.*}})

// Empty names are not reported.
Object.defineProperty(func, 'name', {writable:true, value:''})
runAndPrint(func)
//CHECK-LABEL: Error
//CHECK-NEXT:    at original ({{.*}})

// Only report names that are strings, not numbers or others.
Object.defineProperty(func, 'name', {writable:true, value:1234})
runAndPrint(func)
//CHECK-LABEL: Error: 1234
//CHECK-NEXT:    at original ({{.*}})

Object.defineProperty(func, 'name', {writable:true, value:undefined})
runAndPrint(func)
//CHECK-LABEL: Error: undefined
//CHECK-NEXT:    at original ({{.*}})

// Native functions can be renamed. Currently native functions with invalid
// names are reported as anonymous, similar to JS functions. What we would
// like to do is preserve the original name  and report that if the set name
// is invalid.
function cosFactory(name, errorText) {
  func = Math.cos;
  Object.defineProperty(func, 'name', {writable:true, value:name})
  obj = {valueOf: function() { throw new Error(errorText); } }
  return function cosWrapper() { func(obj); }
}

runAndPrint(cosFactory(123, "CosTest1"));
//CHECK-LABEL: Error: CosTest1
//CHECK-NEXT:    at valueOf ({{.*}})
//CHECK-NEXT:    at anonymous (native)
//CHECK-NEXT:    at cosWrapper ({{.*}})
//CHECK-NEXT:    at runAndPrint ({{.*}})
//CHECK-NEXT:    at global ({{.*}})

runAndPrint(cosFactory(null, "CosTest2"));
//CHECK-LABEL: Error: CosTest2
//CHECK-NEXT:    at valueOf ({{.*}})
//CHECK-NEXT:    at anonymous (native)
//CHECK-NEXT:    at cosWrapper ({{.*}})
//CHECK-NEXT:    at runAndPrint ({{.*}})
//CHECK-NEXT:    at global ({{.*}})

runAndPrint(cosFactory('', "CosTest3"));
//CHECK-LABEL: Error: CosTest3
//CHECK-NEXT:    at valueOf ({{.*}})
//CHECK-NEXT:    at anonymous (native)
//CHECK-NEXT:    at cosWrapper ({{.*}})
//CHECK-NEXT:    at runAndPrint ({{.*}})
//CHECK-NEXT:    at global ({{.*}})

runAndPrint(cosFactory('totallycosine', "CosTest4"));
//CHECK-LABEL: Error: CosTest4
//CHECK-NEXT:    at valueOf ({{.*}})
//CHECK-NEXT:    at totallycosine (native)
//CHECK-NEXT:    at cosWrapper ({{.*}})
//CHECK-NEXT:    at runAndPrint ({{.*}})
//CHECK-NEXT:    at global ({{.*}})

// Accessors should be ignored.
func = function original2() { throw new Error("original2"); }
Object.defineProperty(func, 'name',
   {get:function() { throw new Error("Don't call me!")} })
runAndPrint(func)
//CHECK-LABEL: Error: original2
//CHECK-NEXT:    at original2 ({{.*}})