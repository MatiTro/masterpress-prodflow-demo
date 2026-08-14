# ProdFlow 0.6.0 TEST

Statyczna wersja testowa aplikacji przygotowana do publikacji przez GitHub Pages.

## Publikacja na GitHub Pages

1. Rozpakuj paczkę.
2. Wgraj **zawartość** paczki do katalogu głównego repozytorium. Plik `index.html` musi znajdować się w katalogu głównym.
3. Zatwierdź zmiany w GitHubie. Obecna konfiguracja Pages opublikuje wersję z gałęzi `main` i katalogu `/(root)`.
4. Po zakończeniu zadania `pages build and deployment` otwórz dotychczasowy adres strony.
5. Wykonaj twarde odświeżenie: `Ctrl+F5`.

Nie wgrywaj samego ZIP-a do repozytorium — najpierw go rozpakuj.

## Dostęp testowy

- login: `admin`
- hasło: `admin`

## Adres e-mail magazynu

Wersja testowa przygotowuje wiadomość w domyślnym programie pocztowym. Adres odbiorcy znajduje się na początku pliku `app.js`:

```js
warehouseEmail: "magazyn@masterpress.com.pl"
```

## Najważniejsze zmiany w 0.6.0

- zwykłe zapisanie nowej Karty Produkcyjnej przenosi zlecenie do kolumny „Zaplanowane”;
- nazwa produktu i wymiar koperty są jednym polem tekstowym;
- w sekcji Grafika i druk można dodać PDF wzoru/siatki (w teście do 3 MB), a operator PPWR może go otworzyć;
- PDF Karty Produkcyjnej ma przygotowane miejsce na przyszły schemat rodzaju wyrobu;
- PPWR zawsze używa farby „Farba wodna” oraz wyłącznie trzech ogólnych nazw kleju;
- operator może poprawić błędną ilość raportu z obowiązkowym powodem i pełną historią korekty;
- dokument zmiany zawiera pobrania i dobry wyrób, a po otwarciu wydruku pozycje są oznaczane jako rozliczone i nie trafiają na kolejny wydruk;
- można ponownie wydrukować kopię ostatniego dokumentu bez ponownego rozliczania pozycji;
- zawieszone zlecenie pozostaje na liście, a operator może przełączyć się na inne i wrócić do niego później;
- Planowanie ma mniejsze kafle, wyśrodkowany podgląd Karty Produkcyjnej i osobne zlecenia konserwacji z checklistą;
- moduł Etykiety automatycznie dobiera wzór i przygotowuje jedną etykietę 100 × 75 mm na każdy karton;
- Carlton i Carlton Packaging LLP korzystają wyłącznie z etykiety Carlton;
- Statystyka otwiera estetyczny raport A4 gotowy do zapisania jako PDF;
- OEE celowo nie jest jeszcze obliczane — definicję wskaźnika trzeba zatwierdzić z biznesem;
- handlowe nazwy produktów w PPWR pozostawiono bez zmian zgodnie z decyzją biznesu.

## Reguły etykiet

- liczba etykiet = `zaokrąglenie w górę(ilość zlecenia / ilość w kartonie)`;
- numer palety wynika z ilości w kartonie i ilości na palecie zapisanych w Karcie Produkcyjnej;
- dla Carlton tekst `small` daje `MISC2360`, a `large` daje `MISC2353`;
- ASIN Carlton jest stały: `B0DHDB7377` i jest drukowany jako kod Code 128;
- `Batch No.` to numer zamówienia klienta;
- etykieta Masterpress zawiera logo, dostarczony kod QR, numer zlecenia klienta, indeks klienta, nazwę produktu i ilość w kartonie;
- anonimowy wzór etykiety pozostaje na późniejszy etap.

## Zalecany test odbiorczy 0.6.0

1. Utwórz Kartę Produkcyjną i kliknij „Zapisz kartę”. Sprawdź, czy zlecenie pojawiło się w „Zaplanowanych”.
2. Dodaj załącznik PDF w sekcji Grafika i druk, otwórz go z Karty Produkcyjnej, a następnie z PPWR.
3. Sprawdź podgląd PDF Karty Produkcyjnej w „Szczegółach” Planowania.
4. Utwórz zlecenie konserwacji i otwórz jego kartę z checklistą.
5. W Panelu Operatora dodaj raport wyniku, wykonaj korektę ilości i sprawdź poprawione sumy.
6. Zawieś zlecenie, przełącz się na inne, a następnie wróć do zawieszonego i je wznów.
7. Dodaj pobranie surowca i dobry wyrób. Otwórz „Dokument zmiany”, wydrukuj nowe pozycje i sprawdź, czy licznik spadł do zera.
8. Dodaj kolejne wpisy i sprawdź, czy drugi dokument nie zawiera wcześniej wydrukowanych pozycji.
9. Utwórz zlecenie Carlton z nazwą zawierającą `small` albo `large`, uzupełnij ilość w kartonie i na palecie, a następnie sprawdź automatyczny wzór, liczbę etykiet, MISC, kod kreskowy i numery palet.
10. Dla innego klienta sprawdź etykietę Masterpress z logo i QR.
11. W Statystyce kliknij „Pobierz raport PDF” i w oknie drukowania wybierz „Zapisz jako PDF”.

## Ograniczenia wersji testowej

Dane są przechowywane lokalnie w `localStorage`, dlatego każdy komputer ma własny zestaw danych. Login `admin/admin` jest demonstracyjny. Wiadomość do magazynu jest przygotowywana automatycznie, ale operator zatwierdza jej wysłanie w programie pocztowym. Docelowo konta, wspólne dane, pliki i wysyłkę e-mail obsłuży backend ASP.NET Core z bazą SQL.
