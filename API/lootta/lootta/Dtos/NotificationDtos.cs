namespace lootta.Dtos;

public class NotificationDto
{
    public int Id { get; set; }
    public string Kind { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string Link { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class NotificationFeedDto
{
    public List<NotificationDto> Items { get; set; } = new();
    public int UnreadCount { get; set; }
}
