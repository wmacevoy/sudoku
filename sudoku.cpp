#include <array>
#include <set>
#include <stdint.h>
#include "capped_cache.h"
#include <string>
#include <iostream>

template <typename T>
bool lt(const std::set<T> &a, const std::set<T> &b)
{
  if (a.size() != b.size())
  {
    return a.size() < b.size();
  }
  auto i = a.begin();
  auto j = b.begin();
  while (i != a.end() && j != b.end())
  {
    if (*i < *j)
    {
      return true;
    }
    if (*j < *i)
    {
      return false;
    }
    ++i;
    ++j;
  }
  return false;
}

// 0 is unselected 1-9 is fixed
using puzzle_t = std::array<std::array<uint8_t, 9>, 9>;

// game is the set of options at each cell
struct game
{
  using choices_t = std::array<std::array<std::set<uint8_t>, 9>, 9>;
  choices_t ok;

  // reset choices to a given puzzle
  bool reset(const puzzle_t &puzzle)
  {
    std::set<uint8_t> all;
    for (uint8_t choice = 1; choice <= 9; ++choice)
    {
      all.insert(choice);
    }
    for (int i = 0; i < 9; ++i)
    {
      for (int j = 0; j < 9; ++j)
      {
        ok[i][j] = all;
      }
    }

    for (int i = 0; i < 9; ++i)
    {
      for (int j = 0; j < 9; ++j)
      {
        if (puzzle[i][j] > 0)
        {
          if (!choose(i, j, puzzle[i][j]))
          {
            return false;
          }
        }
      }
    }
    return true;
  }

  // some cell has no choices
  bool failed() const
  {
    return minimum() == 0;
  }

  // all cells have 1 choice
  bool finished() const
  {
    return minimum() == 1;
  }

  bool propegate_isolation(int i, int j, uint8_t choice)
  {
    auto &okij = ok[i][j];
    auto at = okij.find(choice);
    if (at != okij.end())
    {
      okij.erase(at);
      if (okij.size() == 1)
      {
        if (!isolate(i, j, *okij.begin()))
        {
          return false;
        }
      }
    }
    return true;
  }

  // check if choice is hidden because it does
  // not exist elsewhere in a row / column / or block
  bool hidden(int i, int j, uint8_t choice) const
  {
    bool hid = true;
    for (int i1 = 0; i1 < 9; ++i1)
    {
      if (i1 != i && ok[i1][j].find(choice) != ok[i1][j].end())
      {
        hid = false;
        break;
      }
    }
    if (!hid)
      return false;
    for (int j1 = 0; j1 < 9; ++j1)
    {
      if (j1 != j && ok[i][j1].find(choice) != ok[i][j1].end())
      {
        hid = false;
        break;
      }
    }
    if (!hid)
      return false;
    int i0 = 3 * (i / 3);
    int j0 = 3 * (j / 3);
    for (int di = 0; di < 3; ++di)
    {
      for (int dj = 0; dj < 3; ++dj)
      {
        int i1 = i0 + di, j1 = j0 + dj;
        if (i != i1 || j != j1)
          if (ok[i1][j1].find(choice) != ok[i1][j1].end())
          {
            hid = false;
            goto done;
          }
      }
    }
  done:
    return hid;
  }

  bool choose(int i, int j, uint8_t choice)
  {
    if (!isolate(i, j, choice))
      return false;
    for (int i1 = 0; i1 < 9; ++i1)
    {
      for (int j1 = 0; j1 < 9; ++j1)
      {
        if (ok[i1][j1].size() == 1)
          continue;
        std::set<std::tuple<int, int, uint8_t>> choices;
        for (auto choice : ok[i1][j1])
        {
          if (hidden(i1, j1, choice))
          {
            choices.emplace(i1, j1, choice);
          }
        }
        for (auto [i1, j1, choice] : choices)
        {
          if (!choose(i1, j1, choice))
          {
            return false;
          }
        }
      }
    }
    return true;
  }

  // remove choices implied by this choice
  bool
  isolate(int i, int j, uint8_t choice)
  {
    if (ok[i][j].find(choice) == ok[i][j].end())
    {
      return false;
    }
    ok[i][j].clear();
    ok[i][j].insert(choice);

    // remove choice from row
    for (int j1 = 0; j1 < 9; ++j1)
    {
      if (j1 != j)
        propegate_isolation(i, j1, choice);
    }

    // remove choice from column
    for (int i1 = 0; i1 < 9; ++i1)
    {
      if (i1 != i)
        propegate_isolation(i1, j, choice);
    }

    // remove choice from subsquare
    int i0 = 3 * (i / 3);
    int j0 = 3 * (j / 3);
    for (int di = 0; di < 3; ++di)
    {
      for (int dj = 0; dj < 3; ++dj)
      {
        int i1 = i0 + di, j1 = j0 + dj;
        if (i != i1 || j != j1)
          propegate_isolation(i1, j1, choice);
      }
    }
    return true;
  }

  // minimum size of choices (ok.size >= 2)
  int minimum() const
  {
    int ans = 10;
    for (int i = 0; i < 9; ++i)
    {
      for (int j = 0; j < 9; ++j)
      {
        int size = ok[i][j].size();
        if (size != 1 && size < ans)
        {
          ans = size;
        }
      }
    }
    return ans < 10 ? ans : 1;
  }

  bool operator<(const game &to) const
  {
    for (int i = 0; i < 9; ++i)
    {
      for (int j = 0; j < 9; ++j)
      {
        if (lt(ok[i][j], to.ok[i][j]))
        {
          return true;
        }
        if (lt(to.ok[i][j], ok[i][j]))
        {
          return false;
        }
      }
    }
    return false;
  }

  int chosen() const
  {
    int ans = 0;
    for (int i = 0; i < 9; ++i)
    {
      for (int j = 0; j < 9; ++j)
      {
        if (ok[i][j].size() == 1)
          ++ans;
      }
    }
    return ans;
  }
};

capped_cache::capped_lru_treeset<game, 100'000> failed;

bool solve(game &state)
{
  if (failed.contains(state))
  {
    return false;
  }
  int min = state.minimum();
  if (min == 0)
  {
    return false;
  }
  if (min == 1)
  {
    return true;
  }

  for (int i = 0; i < 9; ++i)
  {
    for (int j = 0; j < 9; ++j)
    {
      const auto &okij = state.ok[i][j];
      if (okij.size() != min)
        continue;
      for (auto choice : okij)
      {
        game substate(state);
        substate.choose(i, j, choice);
        if (solve(substate))
        {
          state = substate;
          return true;
        }
      }
    }
  }
  failed.insert(state);
  return false;
}

bool solve(puzzle_t &puzzle)
{
  failed.clear();
  game state;
  state.reset(puzzle);
  if (solve(state))
  {
    for (int i = 0; i < 9; ++i)
    {
      for (int j = 0; j < 9; ++j)
      {
        puzzle[i][j] = *state.ok[i][j].begin();
      }
    }
    return true;
  }
  else
  {
    return false;
  }
}

char encode(uint8_t value)
{
  return (value > 0) ? '0' + value : '-';
}

void print(const puzzle_t &puzzle)
{
  for (int i = 0; i < 9; ++i)
  {
    if (i % 3 == 0)
    {
      std::cout << "+---+---+---+" << std::endl;
    }
    for (int b = 0; b < 3; ++b)
    {
      std::cout << "|";
      for (int j = 0; j < 3; ++j)
      {
        std::cout << encode(puzzle[i][3 * b + j]);
      }
    }
    std::cout << "|" << std::endl;
  }
  std::cout << "+---+---+---+" << std::endl;
}

int main()
{
  puzzle_t puzzle;
  std::string line;

  for (int i = 0; i < 9; ++i)
  {
    if (i % 3 == 0)
    {
      getline(std::cin, line);
    }
    getline(std::cin, line);
    for (int j = 0; j < 9; ++j)
    {
      int jj = 1 + j / 3 + j; // extra format columns
      if (line[jj] >= '1' && line[jj] <= '9')
      {
        puzzle[i][j] = line[jj] - '0';
      }
      else
      {
        puzzle[i][j] = 0;
      }
    }
  }

  print(puzzle);
  if (solve(puzzle))
  {
    game check;
    if (!check.reset(puzzle) || !check.finished())
    {
      std::cout << "check failed" << std::endl;
    }
    print(puzzle);
  }
  else
  {
    std::cout << "no solution" << std::endl;
  }

  return 0;
}