import sqlite3


def getConnection():
    con = sqlite3.connect("pacotesArch.db")
    con.row_factory = sqlite3.Row
    return con


con = getConnection()

cursor = con.cursor()