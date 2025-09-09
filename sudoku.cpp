#include <tuple>
#include <array>
#include <stdint.h>
#include <string>
#include <iostream>

// single threaded choice (1..9) for suduko option tracking
class choices_t
{
private:
  uint8_t _size;

public:
  uint8_t size() const noexcept { return _size; }

private:
  // _first = 10 when the set is empty
  uint8_t _first;

public:
  uint8_t first() const noexcept { return _first; }

private:
  uint16_t _bits;

public:
  uint16_t bits() const noexcept { return _bits; }

public:
  choices_t() noexcept { all(); }

public:
  void all() noexcept
  {
    _bits = 0b111'1111'1110;
    _size = 9;
    _first = 1;
  }

public:
  void none() noexcept
  {
    _bits = 0b000'0000'0000;
    _size = 0;
    _first = 10;
  }

  void one(uint8_t choice) noexcept
  {
    if (1 <= choice && choice <= 9)
    {
      _bits = 1 << choice;
      _size = 1;
      _first = choice;
    }
    else
    {
      none();
    }
  }

  bool is_one(uint8_t choice) const noexcept
  {
    return _size == 1 && _first == choice;
  }

public:
  bool contains(uint8_t choice) const noexcept { return choice < 10 && ((_bits & (1 << choice)) != 0); }

public:
  bool insert(uint8_t choice) noexcept
  {
    if (choice == 0 || choice > 9)
      return false;
    if (!contains(choice))
    {
      _bits ^= (1 << choice);
      ++_size;
      if (choice < _first)
        _first = choice;
      return true;
    }
    else
    {
      return false;
    }
  }

public:
  bool remove(uint8_t choice) noexcept
  {
    if (!contains(choice))
      return false;
    _bits ^= (1 << choice);
    --_size;
    if (choice == _first)
    {
      if (_size == 0)
      {
        _first = 10;
      }
      else
      {
        do
        {
          ++_first;
        } while (((1 << _first) & _bits) == 0);
      }
    }
    return true;
  }

  uint8_t next(uint8_t choice) const noexcept
  {
    if (choice < _first)
      return _first;
    do
    {
      ++choice;
    } while (choice < 10 && !contains(choice));
    return choice;
  }

public:
  bool operator<(const choices_t &to) const noexcept { return _bits < to._bits; }

public:
  bool operator<=(const choices_t &to) const noexcept { return _bits <= to._bits; }

public:
  bool operator==(const choices_t &to) const noexcept { return _bits == to._bits; }

public:
  bool operator!=(const choices_t &to) const noexcept { return _bits != to._bits; }

public:
  bool operator>=(const choices_t &to) const noexcept { return _bits >= to._bits; }

public:
  bool operator>(const choices_t &to) const noexcept { return _bits > to._bits; }

public:
  int hash() const noexcept { return _bits ^ 0x101'1010'1010; }
};

template <>
struct std::hash<choices_t>
{
  std::size_t operator()(choices_t const &s) const noexcept { return s.hash(); }
};

struct counts_t
{
  std::array<uint8_t, 9> bins;
  counts_t() { all(); }
  void all() { bins.fill(9); }
  uint8_t remove(uint8_t choice) { return (1 <= choice && choice <= 9 && bins[choice - 1] > 0) ? --bins[choice - 1] : 0; }
  uint8_t options(uint8_t choice) const { return (1 <= choice && choice <= 9) ? bins[choice - 1] : 0; }
};

using puzzle_t = std::array<std::array<uint8_t, 9>, 9>;

struct game
{
  using board_t = std::array<std::array<choices_t, 9>, 9>;
  board_t board;
  counts_t rows[9], cols[9], boxes[3][3];

  void all()
  {
    for (int i = 0; i < 9; ++i)
    {
      for (int j = 0; j < 9; ++j)
      {
        board[i][j].all();
      }
    }

    for (int i = 0; i < 9; ++i)
    {
      rows[i].all();
    }
    for (int j = 0; j < 9; ++j)
    {
      cols[j].all();
    }
    for (int i0 = 0; i0 < 3; ++i0)
    {
      for (int j0 = 0; j0 < 3; ++j0)
      {
        boxes[i0][j0].all();
      }
    }
  }

  // reset choices to a given puzzle (false means puzzle is impossible, true means it might be solvable)
  bool reset(const puzzle_t &puzzle)
  {
    all();

    for (int i = 0; i < 9; ++i)
    {
      for (int j = 0; j < 9; ++j)
      {
        uint8_t choice = puzzle[i][j];
        if (1 <= choice && choice <= 9)
        {
          if (!choose(i, j, choice))
          {
            return false;
          }
        }
      }
    }
    return true;
  }

  bool choose(int i, int j, uint8_t choice)
  {
    auto &boardij = board[i][j];
    if (!boardij.contains(choice))
    {
      return false;
    }
    if (boardij.size() == 1)
    {
      return true;
    }
    for (uint8_t unchoice = boardij.first(); unchoice != 10; unchoice = boardij.next(unchoice))
    {
      if (unchoice == choice)
        continue;
      if (!unchoose(i, j, unchoice))
        return false;
    }
    return boardij.is_one(choice);
  }

  bool unchoose(int i, int j, uint8_t unchoice)
  {
    auto &boardij = board[i][j];
    if (!boardij.contains(unchoice))
    {
      return true;
    }
    boardij.remove(unchoice);

    uint8_t bi = i / 3, bj = j / 3, i0 = 3 * bi, j0 = 3 * bj;
    auto &row = rows[i];
    auto &col = cols[j];
    auto &box = boxes[bi][bj];

    row.remove(unchoice);
    col.remove(unchoice);
    box.remove(unchoice);

    bool propegate = true;
    bool single = false;
    bool row_chosen = false;
    bool col_chosen = false;
    bool box_chosen = false;

    while (propegate)
    {
      propegate = false;

      if (!single && boardij.size() == 1)
      {
        single = true;

        uint8_t choice = boardij.first();
        if (row.options(choice) > 1)
          for (int j1 = 0; j1 < 9; ++j1)
          {
            if (j1 == j)
              continue;
            if (board[i][j1].contains(choice))
            {
              propegate = true;
              if (!unchoose(i, j1, choice))
                return false;
            }
          }
        if (col.options(choice) > 1)
          for (int i1 = 0; i1 < 9; ++i1)
          {
            if (i1 == i)
              continue;
            if (board[i1][j].contains(choice))
            {
              propegate = true;
              if (!unchoose(i1, j, choice))
                return false;
            }
          }
        if (box.options(choice) > 1)
          for (int di = 0; di < 3; ++di)
          {
            for (int dj = 0; dj < 3; ++dj)
            {
              int i1 = i0 + di, j1 = j0 + dj;
              if (i1 == i && j1 == j)
                continue;
              if (board[i1][j1].contains(choice))
              {
                propegate = true;
                if (!unchoose(i1, j1, choice))
                  return false;
              }
            }
          }
      }

      if (!row_chosen && row.options(unchoice) == 1)
      {
        for (int j1 = 0; j1 < 9; ++j1)
        {
          if (board[i][j1].size() > 1 && board[i][j1].contains(unchoice))
          {
            propegate = true;
            if (!choose(i, j1, unchoice))
              return false;
            row_chosen = true;
            break;
          }
        }
      }

      if (!col_chosen && col.options(unchoice) == 1)
      {
        for (int i1 = 0; i1 < 9; ++i1)
        {
          if (board[i1][j].size() > 1 && board[i1][j].contains(unchoice))
          {
            propegate = true;
            if (!choose(i1, j, unchoice))
              return false;
            col_chosen = true;
            break;
          }
        }
      }

      if (!box_chosen && box.options(unchoice) == 1)
      {
        for (int di = 0; di < 3; ++di)
        {
          for (int dj = 0; dj < 3; ++dj)
          {
            int i1 = i0 + di, j1 = j0 + dj;
            if (board[i1][j1].size() > 1 && board[i1][j1].contains(unchoice))
            {
              propegate = true;
              if (!choose(i1, j1, unchoice))
                return false;
              box_chosen = true;
              goto done;
            }
          }
        }
      done:;
      }
    }
    return !boardij.contains(unchoice);
  }

  std::pair<int, int> minimum() const
  {
    std::pair<int, int> ans(-1, -1);
    int min = 10;
    for (int i = 0; i < 9; ++i)
    {
      for (int j = 0; j < 9; ++j)
      {
        int size = board[i][j].size();
        if (size != 1 && size < min)
        {
          min = size;
          ans = std::pair<int, int>(i, j);
        }
      }
    }
    if (min == 10)
    {
      // all sizes were 1 - no choices to make
      ans = std::pair<int, int>(0, 0);
    }
    return ans;
  }

  bool operator<(const game &to) const
  {
    for (int i = 0; i < 9; ++i)
    {
      for (int j = 0; j < 9; ++j)
      {
        if (board[i][j] < to.board[i][j])
        {
          return true;
        }
        if (to.board[i][j] < board[i][j])
        {
          return false;
        }
      }
    }
    return false;
  }
};

bool solve(game &state)
{
  auto [i, j] = state.minimum();

  const auto &boardij = state.board[i][j];
  if (boardij.size() < 2)
  {
    return boardij.size() == 1;
  }
  for (auto choice = boardij.first(); choice != 10; choice = boardij.next(choice))
  {
    game substate(state);
    if (substate.choose(i, j, choice) && solve(substate))
    {
      state = substate;
      return true;
    }
  }
  return false;
}

bool solve(puzzle_t &puzzle)
{
  game state;
  if (!(state.reset(puzzle) && solve(state)))
  {
    std::cout << "unsolvable" << std::endl;
    return false;
  }
  for (int i = 0; i < 9; ++i)
  {
    for (int j = 0; j < 9; ++j)
    {
      puzzle[i][j] = state.board[i][j].first();
    }
  }
  return true;
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
    print(puzzle);
  }
  else
  {
    std::cout << "no solution" << std::endl;
  }

  return 0;
}