# ProdFlow 0.11.0 — GITHUB TEST

Ta paczka służy wyłącznie do testów funkcjonalnych z biznesem na GitHub Pages. Nie wymaga ASP.NET Core ani SQL Servera.

## Logowanie

- login: `admin`
- hasło: `admin`

W module `Konta i dostęp` można utworzyć dodatkowe konta testowe, np. konto operatora.

## Nowości w wersji 0.11.0

- całkowicie uporządkowany Dashboard bez wysyłek, zapotrzebowań, przepływu materiałów, maszyn i skrótów,
- Dashboard pokazuje zmianę, zlecenia do zaplanowania, kolejkę, produkcję, priorytety i sprawy wymagające reakcji,
- usunięty moduł `Magazyn` — zostanie przygotowany jako osobny, późniejszy projekt,
- mniejszy i bardziej zwarty panel operatora,
- przyciski `Zawieś zlecenie` i `Zlecenie spadło` przeniesione pod `Ostatnie zdarzenia`, z dala od raportowania wyniku,
- automatyczny wydruk etykiet podzielony na partie po 100, 250 albo 500 sztuk,
- przy dużych nakładach system generuje tylko wybrany zakres etykiet i po wydruku wybiera następną partię,
- zachowana globalna numeracja kartonów i palet pomiędzy partiami wydruku.

Wersja zawiera również wcześniejsze funkcje 0.10.0: warianty Carlton Small/Large, dwujęzyczną listę kontrolną JB, moduł Reklamacje oraz poprawiony panel dokumentów produkcyjnych.

Numer ASIN dla wariantu `Small` jest skonfigurowany jako `B0DHDB7377`. Wariant `Large` wymaga uzupełnienia właściwego numeru ASIN przed wydrukiem.

## Publikacja na GitHub Pages

1. Rozpakuj ZIP.
2. Wgraj **całą zawartość** paczki do głównego katalogu repozytorium — plik `index.html` musi leżeć w katalogu głównym.
3. W GitHub wybierz `Settings → Pages`.
4. Ustaw publikację z gałęzi `main` i katalogu `/ (root)`.
5. Otwórz adres pokazany przez GitHub Pages.

Po aktualizacji plików odczekaj chwilę i odśwież stronę skrótem `Ctrl+F5`.

## Szybki test etykiety Carlton

1. W `Karcie produkcyjnej` wpisz klienta zawierającego nazwę `Carlton`.
2. W sekcji produktu wybierz wariant `Small` albo `Large`.
3. Uzupełnij numer zamówienia klienta, indeks klienta, ilość zlecenia i ilość na palecie.
4. Przekaż kartę do planowania i otwórz moduł `Etykiety`.
5. Dla `Small` system stosuje 200 szt. / karton, `MISC2360` i ASIN `B0DHDB7377`.
6. Wydruk wariantu `Large` pozostaje zablokowany do czasu podania właściwego numeru ASIN.

Przy dużej liczbie etykiet wybierz w oknie wydruku wielkość partii. Zalecane ustawienie to `250`. Po otwarciu jednej partii okno ProdFlow pozostaje gotowe do wydrukowania następnej.

## Szybki test nowej karty palety

1. Zaloguj się jako `admin / admin`.
2. W `Karta produkcyjna` utwórz i zapisz zlecenie z wymiarami oraz liczbą sztuk na palecie.
3. Otwórz `Produkcja`, wybierz zlecenie i naciśnij `START`.
4. Potwierdź oczyszczenie linii.
5. Po skompletowaniu palety wybierz `Zakończ paletę` i wypełnij kontrolę P/N.
6. Wejdź w `Kontrole palet`, aby zobaczyć historię i użyć `Drukuj / zapisz PDF`.

Przy zaznaczeniu dowolnej niezgodności `N` system wymaga komentarza i oznacza paletę na czerwono.

## Test kontroli kodu kreskowego

1. Otwórz `Jakość → Kontrola kodów`.
2. Wpisz klienta, nazwę wyrobu i wybierz rodzaj kontroli oraz liczbę próbek.
3. Kliknij pole skanowania i użyj skanera USB. Możesz też wpisać kod ręcznie i nacisnąć Enter.
4. Po zarejestrowaniu wszystkich próbek zapisz protokół.
5. W rejestrze wybierz `Podgląd / PDF`, aby wydrukować lub zapisać dokument.

Testowy poprawny kod EAN-13 do ręcznego wpisania: `5901234123457`.

## Szybki test reklamacji

1. Otwórz `Jakość → Reklamacje`.
2. Wybierz `Reklamacja surowca`, `Reklamacja wyrobu gotowego` albo `Niezgodność procesu`.
3. Uzupełnij pola oznaczone gwiazdką i zapisz zgłoszenie.
4. Z rejestru użyj przycisku `PDF`, aby wydrukować dokument lub zapisać go jako PDF.
5. Dotychczasowy formularz kasacji znajduje się osobno w `Jakość → Wniosek kasacji`.

## Ważne ograniczenia trybu testowego

- dane zapisują się tylko w pamięci przeglądarki na danym komputerze,
- inne komputery nie widzą tych samych danych,
- wyczyszczenie danych witryny usuwa dane testowe,
- wiadomości e-mail nie są faktycznie wysyłane,
- załączniki działają tylko do zamknięcia lub odświeżenia karty przeglądarki,
- nie używaj tej paczki jako wersji produkcyjnej.

Wersja `SERVER-ROCKY9-x64` korzysta z właściwego API, Microsoft SQL Servera, kont serwerowych, trwałych załączników i kolejki e-mail.
