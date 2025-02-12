/*
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the LICENSE
 * file in the root directory of this source tree.
 */
#include "hermes/VM/SymbolRegistry.h"

#include "hermes/VM/GC.h"
#include "hermes/VM/GCPointer.h"
#include "hermes/VM/Handle-inline.h"
#include "hermes/VM/HermesValue.h"
#include "hermes/VM/OrderedHashMap.h"
#include "hermes/VM/Runtime.h"
#include "hermes/VM/SlotAcceptor.h"
#include "hermes/VM/StringPrimitive.h"

namespace hermes {
namespace vm {

void SymbolRegistry::init(Runtime *runtime) {
  stringMap_ = HermesValue::encodeObjectValue(
      vmcast<OrderedHashMap>(*OrderedHashMap::create(runtime)));
}

/// Mark the Strings and Symbols in the registry as roots.
void SymbolRegistry::markRoots(SlotAcceptor &acceptor) {
  acceptor.accept(stringMap_);
}

CallResult<SymbolID> SymbolRegistry::getSymbolForKey(
    Runtime *runtime,
    Handle<StringPrimitive> key) {
  HashMapEntry *it = OrderedHashMap::find(
      Handle<OrderedHashMap>::vmcast(&stringMap_), runtime, key);
  if (it) {
    return it->value.getSymbol();
  }

  auto symbolRes =
      runtime->getIdentifierTable().createNotUniquedSymbol(runtime, key);
  if (LLVM_UNLIKELY(symbolRes == ExecutionStatus::EXCEPTION)) {
    return ExecutionStatus::EXCEPTION;
  }
  Handle<SymbolID> symbol = runtime->makeHandle(*symbolRes);

  if (LLVM_UNLIKELY(
          OrderedHashMap::insert(
              Handle<OrderedHashMap>::vmcast(&stringMap_),
              runtime,
              key,
              symbol) == ExecutionStatus::EXCEPTION)) {
    return ExecutionStatus::EXCEPTION;
  }

  registeredSymbols_.insert(symbol.get());
  return symbol.get();
}

} // namespace vm
} // namespace hermes
