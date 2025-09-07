// capped_caches.hpp
#pragma once
#include <cstddef>
#include <list>
#include <map>
#include <set>
#include <unordered_map>
#include <unordered_set>
#include <vector>
#include <random>
#include <utility>
#include <type_traits>

namespace capped_cache {
// Helper: pointer hash/equal for const Key*
template<class Key>
struct ptr_hash {
    std::size_t operator()(const Key* p) const noexcept {
        // hash by address; safe because the pointed-to Key lifetime is managed by the owner container
        return std::hash<const void*>()(static_cast<const void*>(p));
    }
};
template<class Key>
struct ptr_equal {
    bool operator()(const Key* a, const Key* b) const noexcept { return a == b; }
};

// ========================== LRU — HASH MAP ==========================
template<class Key, class Value, std::size_t N,
         class Hash = std::hash<Key>, class KeyEq = std::equal_to<Key>>
class capped_lru_hashmap {
    static_assert(N > 0, "Capacity must be > 0");
    using list_t = std::list<const Key*>;               // MRU at front
    struct entry { Value value; typename list_t::iterator pos; };
    std::unordered_map<Key, entry, Hash, KeyEq> index_; // stores Key exactly once
    list_t order_;                                      // pointers into index_.keys()

    void touch(typename list_t::iterator it) {
        if (it != order_.begin()) order_.splice(order_.begin(), order_, it);
    }
    void evict_if_needed() {
        if (index_.size() <= N) return;
        const Key* kptr = order_.back();
        order_.pop_back();
        index_.erase(*kptr);
    }

public:
    static constexpr std::size_t capacity() noexcept { return N; }
    std::size_t size() const noexcept { return index_.size(); }
    bool empty() const noexcept { return index_.empty(); }
    void clear() { index_.clear(); order_.clear(); }

    bool contains(const Key& k) const { return index_.find(k) != index_.end(); }

    Value* get(const Key& k) {
        auto it = index_.find(k);
        if (it == index_.end()) return nullptr;
        touch(it->second.pos);
        return &it->second.value;
    }
    const Value* get(const Key& k) const {
        auto it = index_.find(k);
        return it == index_.end() ? nullptr : &it->second.value;
    }

    template<class... Args>
    Value& emplace_or_assign(const Key& k, Args&&... args) {
        auto it = index_.find(k);
        if (it != index_.end()) {
            it->second.value = Value(std::forward<Args>(args)...);
            touch(it->second.pos);
            return it->second.value;
        }
        // insert new
        auto node = order_.insert(order_.begin(), nullptr); // placeholder, fix after emplace
        auto [ins, _] = index_.emplace(std::piecewise_construct,
                                       std::forward_as_tuple(k),
                                       std::forward_as_tuple(Value(std::forward<Args>(args)...), node));
        *node = &ins->first;
        evict_if_needed();
        // If eviction happened and our iterator possibly invalid? unordered_map rehash
        // order_ holds pointers to keys (address is stable across rehash), list iterators stay valid.
        return ins->second.value;
    }

    bool erase(const Key& k) {
        auto it = index_.find(k);
        if (it == index_.end()) return false;
        order_.erase(it->second.pos);
        index_.erase(it);
        return true;
    }
};

// ========================== LRU — TREE MAP ==========================
template<class Key, class Value, std::size_t N,
         class Compare = std::less<Key>>
class capped_lru_treemap {
    static_assert(N > 0, "Capacity must be > 0");
    using list_t = std::list<const Key*>;
    struct entry { Value value; typename list_t::iterator pos; };
    std::map<Key, entry, Compare> index_;
    list_t order_;

    void touch(typename list_t::iterator it) {
        if (it != order_.begin()) order_.splice(order_.begin(), order_, it);
    }
    void evict_if_needed() {
        if (index_.size() <= N) return;
        const Key* kptr = order_.back();
        order_.pop_back();
        index_.erase(*kptr);
    }

public:
    static constexpr std::size_t capacity() noexcept { return N; }
    std::size_t size() const noexcept { return index_.size(); }
    bool empty() const noexcept { return index_.empty(); }
    void clear() { index_.clear(); order_.clear(); }

    bool contains(const Key& k) const { return index_.find(k) != index_.end(); }

    Value* get(const Key& k) {
        auto it = index_.find(k);
        if (it == index_.end()) return nullptr;
        touch(it->second.pos);
        return &it->second.value;
    }
    const Value* get(const Key& k) const {
        auto it = index_.find(k);
        return it == index_.end() ? nullptr : &it->second.value;
    }

    template<class... Args>
    Value& emplace_or_assign(const Key& k, Args&&... args) {
        auto it = index_.find(k);
        if (it != index_.end()) {
            it->second.value = Value(std::forward<Args>(args)...);
            touch(it->second.pos);
            return it->second.value;
        }
        auto node = order_.insert(order_.begin(), nullptr);
        auto ins = index_.emplace(k, entry{Value(std::forward<Args>(args)...), node}).first;
        *node = &ins->first;
        evict_if_needed();
        return ins->second.value;
    }

    bool erase(const Key& k) {
        auto it = index_.find(k);
        if (it == index_.end()) return false;
        order_.erase(it->second.pos);
        index_.erase(it);
        return true;
    }
};

// ========================== LRU — HASH SET ==========================
template<class Key, std::size_t N,
         class Hash = std::hash<Key>, class KeyEq = std::equal_to<Key>>
class capped_lru_hashset {
    static_assert(N > 0, "Capacity must be > 0");
    using list_t = std::list<const Key*>;
    std::unordered_set<Key, Hash, KeyEq> keys_;                 // sole owner of Key
    list_t order_;                                              // recency list of pointers to keys_.nodes
    std::unordered_map<const Key*, typename list_t::iterator,
                       ptr_hash<Key>, ptr_equal<Key>> pos_;     // pointer -> node in list

    void touch(const Key* kp) {
        auto it = pos_.find(kp);
        if (it != pos_.end() && it->second != order_.begin())
            order_.splice(order_.begin(), order_, it->second);
    }
    void evict_if_needed() {
        if (keys_.size() <= N) return;
        const Key* victim = order_.back();
        order_.pop_back();
        pos_.erase(victim);
        keys_.erase(*victim);
    }

public:
    static constexpr std::size_t capacity() noexcept { return N; }
    std::size_t size() const noexcept { return keys_.size(); }
    bool empty() const noexcept { return keys_.empty(); }
    void clear() { keys_.clear(); order_.clear(); pos_.clear(); }

    bool contains(const Key& k) {
        auto it = keys_.find(k);
        if (it == keys_.end()) return false;
        touch(&*it);
        return true;
    }

    // insert returns true if inserted, false if already present (and touched)
    bool insert(const Key& k) {
        auto [it, fresh] = keys_.insert(k);
        const Key* kp = &*it;
        if (fresh) {
            auto node = order_.insert(order_.begin(), kp);
            pos_[kp] = node;
            evict_if_needed();
            return true;
        } else {
            touch(kp);
            return false;
        }
    }

    bool erase(const Key& k) {
        auto it = keys_.find(k);
        if (it == keys_.end()) return false;
        const Key* kp = &*it;
        order_.erase(pos_[kp]);
        pos_.erase(kp);
        keys_.erase(it);
        return true;
    }
};

// ========================== LRU — TREE SET ==========================
template<class Key, std::size_t N,
         class Compare = std::less<Key>>
class capped_lru_treeset {
    static_assert(N > 0, "Capacity must be > 0");
    using list_t = std::list<const Key*>;
    std::set<Key, Compare> keys_;
    list_t order_;
    std::unordered_map<const Key*, typename list_t::iterator,
                       ptr_hash<Key>, ptr_equal<Key>> pos_;

    void touch(const Key* kp) {
        auto it = pos_.find(kp);
        if (it != pos_.end() && it->second != order_.begin())
            order_.splice(order_.begin(), order_, it->second);
    }
    void evict_if_needed() {
        if (keys_.size() <= N) return;
        const Key* victim = order_.back();
        order_.pop_back();
        pos_.erase(victim);
        keys_.erase(*victim);
    }

public:
    static constexpr std::size_t capacity() noexcept { return N; }
    std::size_t size() const noexcept { return keys_.size(); }
    bool empty() const noexcept { return keys_.empty(); }
    void clear() { keys_.clear(); order_.clear(); pos_.clear(); }

    bool contains(const Key& k) {
        auto it = keys_.find(k);
        if (it == keys_.end()) return false;
        touch(&*it);
        return true;
    }

    bool insert(const Key& k) {
        auto [it, fresh] = keys_.insert(k);
        const Key* kp = &*it;
        if (fresh) {
            auto node = order_.insert(order_.begin(), kp);
            pos_[kp] = node;
            evict_if_needed();
            return true;
        } else {
            touch(kp);
            return false;
        }
    }

    bool erase(const Key& k) {
        auto it = keys_.find(k);
        if (it == keys_.end()) return false;
        const Key* kp = &*it;
        order_.erase(pos_[kp]);
        pos_.erase(kp);
        keys_.erase(it);
        return true;
    }
};

// ========================== RR — HASH MAP ==========================
template<class Key, class Value, std::size_t N,
         class Hash = std::hash<Key>, class KeyEq = std::equal_to<Key>>
class capped_rr_hashmap {
    static_assert(N > 0, "Capacity must be > 0");
    // store Key exactly once (as unordered_map key)
    std::unordered_map<Key, Value, Hash, KeyEq> kv_;
    // eviction structure
    std::vector<const Key*> slots_; // random victim pool (pointers to kv_.keys)
    std::unordered_map<const Key*, std::size_t, ptr_hash<Key>, ptr_equal<Key>> where_;
    mutable std::mt19937 rng_{std::random_device{}()};

    void evict_if_needed() {
        if (kv_.size() <= N) return;
        std::uniform_int_distribution<std::size_t> d(0, slots_.size() - 1);
        std::size_t victim_i = d(rng_);
        const Key* victim_k = slots_[victim_i];
        // remove from vectors/maps first
        const std::size_t last = slots_.size() - 1;
        if (victim_i != last) {
            slots_[victim_i] = slots_[last];
            where_[slots_[victim_i]] = victim_i;
        }
        slots_.pop_back();
        where_.erase(victim_k);
        kv_.erase(*victim_k);
    }
    void add_slot(typename std::unordered_map<Key, Value, Hash, KeyEq>::iterator it) {
        const Key* kp = &it->first;
        where_[kp] = slots_.size();
        slots_.push_back(kp);
    }

public:
    static constexpr std::size_t capacity() noexcept { return N; }
    std::size_t size() const noexcept { return kv_.size(); }
    bool empty() const noexcept { return kv_.empty(); }
    void clear() { kv_.clear(); slots_.clear(); where_.clear(); }

    Value* get(const Key& k) {
        auto it = kv_.find(k);
        return it == kv_.end() ? nullptr : &it->second;
    }
    const Value* get(const Key& k) const {
        auto it = kv_.find(k);
        return it == kv_.end() ? nullptr : &it->second;
    }
    bool contains(const Key& k) const { return kv_.find(k) != kv_.end(); }

    template<class... Args>
    Value& emplace_or_assign(const Key& k, Args&&... args) {
        auto it = kv_.find(k);
        if (it != kv_.end()) {
            it->second = Value(std::forward<Args>(args)...);
            return it->second;
        }
        auto ins = kv_.emplace(k, Value(std::forward<Args>(args)...)).first;
        add_slot(ins);
        evict_if_needed();
        return ins->second;
    }

    bool erase(const Key& k) {
        auto it = kv_.find(k);
        if (it == kv_.end()) return false;
        const Key* kp = &it->first;
        std::size_t idx = where_[kp];
        const std::size_t last = slots_.size() - 1;
        if (idx != last) {
            slots_[idx] = slots_[last];
            where_[slots_[idx]] = idx;
        }
        slots_.pop_back();
        where_.erase(kp);
        kv_.erase(it);
        return true;
    }
};

// ========================== RR — TREE MAP ==========================
template<class Key, class Value, std::size_t N,
         class Compare = std::less<Key>>
class capped_rr_treemap {
    static_assert(N > 0, "Capacity must be > 0");
    std::map<Key, Value, Compare> kv_;
    std::vector<const Key*> slots_;
    std::unordered_map<const Key*, std::size_t, ptr_hash<Key>, ptr_equal<Key>> where_;
    mutable std::mt19937 rng_{std::random_device{}()};

    void evict_if_needed() {
        if (kv_.size() <= N) return;
        std::uniform_int_distribution<std::size_t> d(0, slots_.size() - 1);
        std::size_t victim_i = d(rng_);
        const Key* victim_k = slots_[victim_i];
        const std::size_t last = slots_.size() - 1;
        if (victim_i != last) {
            slots_[victim_i] = slots_[last];
            where_[slots_[victim_i]] = victim_i;
        }
        slots_.pop_back();
        where_.erase(victim_k);
        kv_.erase(*victim_k);
    }
    void add_slot(typename std::map<Key, Value, Compare>::iterator it) {
        const Key* kp = &it->first;
        where_[kp] = slots_.size();
        slots_.push_back(kp);
    }

public:
    static constexpr std::size_t capacity() noexcept { return N; }
    std::size_t size() const noexcept { return kv_.size(); }
    bool empty() const noexcept { return kv_.empty(); }
    void clear() { kv_.clear(); slots_.clear(); where_.clear(); }

    Value* get(const Key& k) {
        auto it = kv_.find(k);
        return it == kv_.end() ? nullptr : &it->second;
    }
    const Value* get(const Key& k) const {
        auto it = kv_.find(k);
        return it == kv_.end() ? nullptr : &it->second;
    }
    bool contains(const Key& k) const { return kv_.find(k) != kv_.end(); }

    template<class... Args>
    Value& emplace_or_assign(const Key& k, Args&&... args) {
        auto [it, fresh] = kv_.emplace(k, Value(std::forward<Args>(args)...));
        if (fresh) add_slot(it);
        evict_if_needed();
        return it->second;
    }

    bool erase(const Key& k) {
        auto it = kv_.find(k);
        if (it == kv_.end()) return false;
        const Key* kp = &it->first;
        std::size_t idx = where_[kp];
        const std::size_t last = slots_.size() - 1;
        if (idx != last) {
            slots_[idx] = slots_[last];
            where_[slots_[idx]] = idx;
        }
        slots_.pop_back();
        where_.erase(kp);
        kv_.erase(it);
        return true;
    }
};

// ========================== RR — HASH SET ==========================
template<class Key, std::size_t N,
         class Hash = std::hash<Key>, class KeyEq = std::equal_to<Key>>
class capped_rr_hashset {
    static_assert(N > 0, "Capacity must be > 0");
    std::unordered_set<Key, Hash, KeyEq> keys_;
    std::vector<const Key*> slots_;
    std::unordered_map<const Key*, std::size_t, ptr_hash<Key>, ptr_equal<Key>> where_;
    mutable std::mt19937 rng_{std::random_device{}()};

    void evict_if_needed() {
        if (keys_.size() <= N) return;
        std::uniform_int_distribution<std::size_t> d(0, slots_.size() - 1);
        std::size_t victim_i = d(rng_);
        const Key* victim_k = slots_[victim_i];
        const std::size_t last = slots_.size() - 1;
        if (victim_i != last) {
            slots_[victim_i] = slots_[last];
            where_[slots_[victim_i]] = victim_i;
        }
        slots_.pop_back();
        where_.erase(victim_k);
        keys_.erase(*victim_k);
    }
    void add_slot(typename std::unordered_set<Key, Hash, KeyEq>::iterator it) {
        const Key* kp = &*it;
        where_[kp] = slots_.size();
        slots_.push_back(kp);
    }

public:
    static constexpr std::size_t capacity() noexcept { return N; }
    std::size_t size() const noexcept { return keys_.size(); }
    bool empty() const noexcept { return keys_.empty(); }
    void clear() { keys_.clear(); slots_.clear(); where_.clear(); }

    bool contains(const Key& k) const { return keys_.find(k) != keys_.end(); }

    bool insert(const Key& k) {
        auto [it, fresh] = keys_.insert(k);
        if (fresh) add_slot(it);
        evict_if_needed();
        return fresh;
    }

    bool erase(const Key& k) {
        auto it = keys_.find(k);
        if (it == keys_.end()) return false;
        const Key* kp = &*it;
        std::size_t idx = where_[kp];
        const std::size_t last = slots_.size() - 1;
        if (idx != last) {
            slots_[idx] = slots_[last];
            where_[slots_[idx]] = idx;
        }
        slots_.pop_back();
        where_.erase(kp);
        keys_.erase(it);
        return true;
    }
};

// ========================== RR — TREE SET ==========================
template<class Key, std::size_t N,
         class Compare = std::less<Key>>
class capped_rr_treeset {
    static_assert(N > 0, "Capacity must be > 0");
    std::set<Key, Compare> keys_;
    std::vector<const Key*> slots_;
    std::unordered_map<const Key*, std::size_t, ptr_hash<Key>, ptr_equal<Key>> where_;
    mutable std::mt19937 rng_{std::random_device{}()};

    void evict_if_needed() {
        if (keys_.size() <= N) return;
        std::uniform_int_distribution<std::size_t> d(0, slots_.size() - 1);
        std::size_t victim_i = d(rng_);
        const Key* victim_k = slots_[victim_i];
        const std::size_t last = slots_.size() - 1;
        if (victim_i != last) {
            slots_[victim_i] = slots_[last];
            where_[slots_[victim_i]] = victim_i;
        }
        slots_.pop_back();
        where_.erase(victim_k);
        keys_.erase(*victim_k);
    }
    void add_slot(typename std::set<Key, Compare>::iterator it) {
        const Key* kp = &*it;
        where_[kp] = slots_.size();
        slots_.push_back(kp);
    }

public:
    static constexpr std::size_t capacity() noexcept { return N; }
    std::size_t size() const noexcept { return keys_.size(); }
    bool empty() const noexcept { return keys_.empty(); }
    void clear() { keys_.clear(); slots_.clear(); where_.clear(); }

    bool contains(const Key& k) const { return keys_.find(k) != keys_.end(); }

    bool insert(const Key& k) {
        auto [it, fresh] = keys_.insert(k);
        if (fresh) add_slot(it);
        evict_if_needed();
        return fresh;
    }

    bool erase(const Key& k) {
        auto it = keys_.find(k);
        if (it == keys_.end()) return false;
        const Key* kp = &*it;
        std::size_t idx = where_[kp];
        const std::size_t last = slots_.size() - 1;
        if (idx != last) {
            slots_[idx] = slots_[last];
            where_[slots_[idx]] = idx;
        }
        slots_.pop_back();
        where_.erase(kp);
        keys_.erase(it);
        return true;
    }
};

} // namespace