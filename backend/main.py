import typer
import re
import csv
from collections import Counter
from typing import Optional

app = typer.Typer()

@app.command()
def wordfreq(
        path: str = typer.Argument(..., help="Путь к текстовому файлу"),
        output: str = typer.Option("wordfreq.csv", "--output", "-o", help="Имя выходного CSV файла"),
        top: Optional[int] = typer.Option(None, "--top", "-t", help="Количество самых частых слов"),
        min_length: int = typer.Option(1, "--min-length", "-m", help="Минимальная длина слова")
):
    """Анализирует частотность слов в текстовом файле и сохраняет в CSV"""

    # Шаг 1: Открываем и читаем файл
    try:
        with open(path, 'r', encoding='utf-8') as file:
            text = file.read()
    except FileNotFoundError:
        typer.echo(f"Ошибка: Файл '{path}' не найден", err=True)
        raise typer.Exit(code=1)

    # Шаг 2: Извлечение слов с помощью регулярного выражения
    text = text.lower()
    # Удаляем все символы, кроме букв, апострофов и пробелов
    text = re.sub(r'[^а-яёa-z\'\s]', ' ', text)
    # Теперь извлекаем слова
    words = re.findall(r"[а-яёa-z]+(?:'[а-яёa-z]+)*", text)
    typer.echo(f"✓ Найдено {len(words)} слов")

    # Шаг 3: Фильтрация по минимальной длине
    words = [word for word in words if len(word) >= min_length]
    typer.echo(f"✓ После фильтрации по длине: {len(words)} слов")

    # Шаг 4: Подсчёт частотности
    word_counts = Counter(words)
    typer.echo(f"✓ Уникальных слов: {len(word_counts)}")

    # Шаг 5: Получаем топ слов
    if top is not None:
        most_common = word_counts.most_common(top)
    else:
        most_common = word_counts.most_common()

    # Шаг 6: Сохраняем в CSV
    try:
        with open(output, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(['Слово', 'Частота'])
            writer.writerows(most_common)
        typer.echo(f"✓ Результат сохранён в '{output}'")
    except Exception as e:
        typer.echo(f"Ошибка при записи файла: {e}", err=True)
        raise typer.Exit(code=1)

    # Шаг 7: Выводим результат в терминал
    typer.echo("\nТоп слов:")
    typer.echo("-" * 30)
    for word, count in most_common[:10]:
        typer.echo(f"{word:15} {count:5}")
    if len(most_common) > 10:
        typer.echo(f"... и ещё {len(most_common) - 10} слов")


if __name__ == "__main__":
    app()