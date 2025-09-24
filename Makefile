CXXFLAGS=-std=c++20 -O3 -g
sudoku : sudoku.cpp capped_cache.h
	$(CXX) $(CXXFLAGS) -o $@ $<
sudoku.out : sudoku sudoku.in
	./sudoku < sudoku.in | tee sudoku.out

