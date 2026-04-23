from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pydantic import BaseModel
import random

#######BAZA DANYCH
engine = create_engine("sqlite:///./kasyno.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True)
    password = Column(String)
    balance = Column(Integer, default=1000)

Base.metadata.create_all(bind=engine)

class UserAuth(BaseModel):
    username: str
    password: str
########

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="frontend"), name="static")

sesje_gry = {}

def stworz_talie():
    rangi = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
    kolory = ['♠', '♣', '♥', '♦']
    
    talia = []
    for k in kolory:
        for r in rangi:
            talia.append(r + k)
    
    random.shuffle(talia)
    return talia

def licz_punkty(reka):
    punkty = 0
    asy = 0
    
    wartosci = {
        '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '10':10,
        'J':10, 'Q':10, 'K':10, 'A':11
    }
    
    for karta in reka:
        ranga = karta[:-1]
        punkty += wartosci[ranga]
        if ranga == 'A':
            asy += 1
            
    while punkty > 21 and asy > 0:
        punkty -= 10
        asy -= 1
        
    return punkty

@app.get("/")
async def glowna_strona():
    return FileResponse('frontend/index.html')

@app.post("/register")
def register(data: UserAuth):
    db = SessionLocal()
    istniejacy = db.query(User).filter(User.username == data.username).first()
    if istniejacy:
        db.close()
        return {"error": "Ten login jest już zajęty!"}
    
    nowy_gracz = User(username=data.username, password=data.password)
    db.add(nowy_gracz)
    db.commit()
    db.close()
    return {"msg": "Konto stworzone! Możesz się zalogować."}

@app.post("/login")
def login(data: UserAuth):
    db = SessionLocal()
    gracz = db.query(User).filter(User.username == data.username, User.password == data.password).first()
    db.close()
    
    if gracz:
        return {"msg": "Zalogowano!", "username": gracz.username, "balance": gracz.balance}
    return {"error": "Błędny login lub hasło!"}

@app.post("/start/{username}")
def start_gry(username: str):
    talia = stworz_talie()
    reka_gracza = [talia.pop(), talia.pop()]
    reka_krupiera = [talia.pop()]
    
    sesje_gry[username] = {
        "talia": talia,
        "reka_gracza": reka_gracza,
        "reka_krupiera": reka_krupiera
    }
    
    return {
        "gracz": reka_gracza,
        "punkty": licz_punkty(reka_gracza),
        "krupier": reka_krupiera[0]
    }

@app.post("/hit/{username}")
def hit(username: str):
    if username not in sesje_gry:
        raise HTTPException(status_code=400, detail="Brak aktywnej gry")
    
    sesja = sesje_gry[username]
    nowa_karta = sesja["talia"].pop()
    sesja["reka_gracza"].append(nowa_karta)
    
    punkty = licz_punkty(sesja["reka_gracza"])
    status = "gra"
    
    if punkty > 21:
        status = "przegrana"
        
    return {
        "gracz": sesja["reka_gracza"],
        "punkty": punkty,
        "status": status
    }

@app.post("/stand/{username}")
def stand(username: str):
    if username not in sesje_gry:
        raise HTTPException(status_code=400, detail="Brak aktywnej gry")
    
    sesja = sesje_gry[username]
    punkty_gracza = licz_punkty(sesja["reka_gracza"])
    
    while licz_punkty(sesja["reka_krupiera"]) < 17:
        sesja["reka_krupiera"].append(sesja["talia"].pop())
        
    punkty_krupiera = licz_punkty(sesja["reka_krupiera"])
    
    wynik = ""
    if punkty_krupiera > 21:
        wynik = "Krupier przekroczył 21! WYGRAŁEŚ!"
    elif punkty_gracza > punkty_krupiera:
        wynik = "WYGRAŁEŚ!"
    elif punkty_gracza < punkty_krupiera:
        wynik = "PRZEGRAŁEŚ!"
    else:
        wynik = "REMIS!"
        
    del sesje_gry[username]
    
    return {
        "krupier_reka": sesja["reka_krupiera"],
        "krupier_punkty": punkty_krupiera,
        "wynik": wynik
    }
