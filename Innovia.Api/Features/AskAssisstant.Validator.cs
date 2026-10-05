using Innovia.Api.Common.Errors;
using Innovia.Api.Common.Result;

namespace Innovia.Api.Features.Assistant.Ask;

public sealed class Validator
{
    private const int MaxMessageLength = 500;

    public ValidationResult Validate(Command command)
    {
        var errors = new List<ValidationError>();

        if (string.IsNullOrWhiteSpace(command.Message))
        {
            errors.Add(new ValidationError("message", "Meddelandet får inte vara tomt."));
        }
        else if (command.Message.Length > MaxMessageLength)
        {
            errors.Add(new ValidationError("message", $"Meddelandet får inte överstiga {MaxMessageLength} tecken."));
        }

        return errors.Count == 0 ? ValidationResult.Success() : ValidationResult.Fail(errors);
    }
}