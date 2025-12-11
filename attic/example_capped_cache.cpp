#include "capped_cache.h"
#include <iostream>
#include <string>

int main() {
    using capped_cache::capped_lru_hashmap;
    using capped_cache::capped_rr_hashmap;

    // LRU: capacity 3
    capped_lru_hashmap<std::string, int, 3> lru;
    lru.emplace_or_assign("a", 1);
    lru.emplace_or_assign("b", 2);
    lru.emplace_or_assign("c", 3);
    (void)lru.get("a");              // touch "a" => MRU
    lru.emplace_or_assign("d", 4);    // evicts LRU ("b")

    std::cout << (lru.get("b") ? "hit\n" : "miss\n"); // miss
    std::cout << *lru.get("a") << "\n";               // 1

    // Random-replacement: capacity 2
    capped_rr_hashmap<int, std::string, 2> rr;
    rr.emplace_or_assign(10, "ten");
    rr.emplace_or_assign(20, "twenty");
    rr.emplace_or_assign(30, "thirty"); // randomly evicts 10 or 20
    return 0;
}