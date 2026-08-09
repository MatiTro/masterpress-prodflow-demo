# ProdFlow 0.4.0 TEST

Statyczna wersja testowa aplikacji przygotowana do publikacji przez GitHub Pages.

## Publikacja na GitHub Pages

1. Rozpakuj paczkę.
2. Wgraj **zawartość** paczki do katalogu głównego repozytorium. Plik `index.html` musi znajdować się w katalogu głównym — nie w dodatkowym podkatalogu.
3. W GitHub przejdź do `Settings` → `Pages`.
4. Wybierz `Deploy from a branch`, gałąź `main` i katalog `/(root)`, a następnie zapisz.
5. Po zakończeniu publikacji otwórz podany przez GitHub adres. Po podmianie wersji wykonaj twarde odświeżenie (`Ctrl+F5`).

Nie wgrywaj samego pliku ZIP do repozytorium — najpierw go rozpakuj.

## Dostęp testowy

- login: `admin`
- hasło: `admin`

## Zalecany test odbiorczy

1. Otwórz „Kartę produkcyjną” i utwórz pierwsze zlecenie.
2. Zapisz kartę, wybierz „+ Nowa karta” i utwórz drugie zlecenie.
3. Przełączaj zapisane karty przez listę „Karty zleceń” i sprawdź, czy dane obu zleceń pozostają niezależne.
4. Przekaż oba zlecenia do planowania i sprawdź je w panelu „Produkcja”.
5. Otwórz PPWR, wybierz zlecenie i użyj „Drukuj / zapisz PDF”. Wydruk powinien mieć dokładnie 3 strony A4.
6. Sprawdź zrywkę `Folia` i `Perforacja` oraz pełne nazwy pasków silikonowych.

## Najważniejsze zmiany

- obsługa wielu kart i wielu zleceń produkcyjnych;
- bezpieczne rozpoczynanie nowej karty bez usuwania poprzedniego zlecenia;
- lista zapisanych kart z możliwością przełączania;
- „Zakładka dolna” zastąpiona polem „Fałda”;
- zrywka jako wybór `Folia` / `Perforacja`;
- paski silikonowe zapisywane przez pełną nazwę;
- PPWR skrócony do 3 stron A4, zarówno dla pustego szablonu, jak i wydruku z danymi;
- klientowski PDF i pusty szablon nie zawierają nazwy ani komunikatów systemu ProdFlow;
- podgląd PPWR obejmuje trzy przełączane, czytelne strony oraz tryb pełnoekranowy;
- responsywny nagłówek Karty Produkcyjnej i mobilne menu dla telefonu oraz tabletu;
- tabele i formularze PPWR zmieniają układ bez wychodzenia poza ekran;
- automatyczne uzupełnianie autora PPWR zalogowanym użytkownikiem;
- odświeżanie zasobów dostosowane do cache GitHub Pages;
- reset pozycji przewinięcia po zmianie modułu.

## Ważne przed użyciem produkcyjnym

Ta wersja jest przeznaczona do testów i prezentacji. Dane są zapisywane lokalnie w przeglądarce (`localStorage`), więc nie synchronizują się między komputerami ani użytkownikami. Login `admin/admin` jest dostępem demonstracyjnym, a nie zabezpieczeniem produkcyjnym. Przed użyciem operacyjnym należy podłączyć backend, wspólną bazę danych, prawdziwe uwierzytelnianie, role oraz kopie zapasowe.

Nazwy typów wyrobów (np. TDB/TVB) pozostawiono bez zmian, ponieważ w przekazanych uwagach wskazano je do zmiany, ale nie podano nazw docelowych.
