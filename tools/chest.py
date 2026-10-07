#!/usr/bin/env python3
"""Debrief chest code. Usage: chest.py SEED   (seed is printed in the campaign report, e.g. MET5-22-431)"""
import sys
def h(s):
    x = 2166136261
    for ch in s:
        x ^= ord(ch); x = (x * 16777619) & 0xffffffff
    return x
def code(seed):
    x = h("exam3|" + seed.strip().upper() + "|chest"); A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; s = ""
    for _ in range(5):
        s += A[x % 32]; x //= 32
    return s
print(code(sys.argv[1]))
