import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, Filter, Star, MessageCircle, Flag, ThumbsUp, ThumbsDown, MoreVertical } from "lucide-react"

export default function RestaurantReviews() {
  // Mock review data
  const reviews = [
    {
      id: 1,
      customer: "John Smith",
      avatar: "/placeholder.svg?height=40&width=40",
      rating: 5,
      date: "2 days ago",
      comment:
        "The food was absolutely delicious! The Chicken Biryani was perfectly spiced and the portion size was generous. Delivery was quick and everything arrived hot. Will definitely order again!",
      order: ["Chicken Biryani", "Garlic Naan"],
      replied: true,
      reply:
        "Thank you for your kind words, John! We're glad you enjoyed your meal and look forward to serving you again soon.",
      helpful: 12,
      unhelpful: 1,
    },
    {
      id: 2,
      customer: "Emily Johnson",
      avatar: "/placeholder.svg?height=40&width=40",
      rating: 4,
      date: "1 week ago",
      comment:
        "Great food and fast delivery. The Paneer Tikka was excellent, though the Naan was a bit undercooked. Overall a good experience.",
      order: ["Paneer Tikka", "Butter Naan", "Mango Lassi"],
      replied: false,
      reply: "",
      helpful: 8,
      unhelpful: 2,
    },
    {
      id: 3,
      customer: "Michael Brown",
      avatar: "/placeholder.svg?height=40&width=40",
      rating: 3,
      date: "2 weeks ago",
      comment:
        "The food was good but delivery took longer than expected. The Chicken Curry was tasty but could have been spicier.",
      order: ["Chicken Curry", "Jeera Rice", "Gulab Jamun"],
      replied: true,
      reply:
        "We appreciate your feedback, Michael. We're sorry about the delivery delay and will work on improving our timing. We'll also note your preference for spicier curry for your next order.",
      helpful: 5,
      unhelpful: 3,
    },
    {
      id: 4,
      customer: "Sarah Wilson",
      avatar: "/placeholder.svg?height=40&width=40",
      rating: 5,
      date: "3 weeks ago",
      comment:
        "Absolutely loved the Veg Fried Rice and Gobi Manchurian! Everything was perfect - taste, packaging, and delivery time. This is now my go-to place for Indian-Chinese fusion.",
      order: ["Veg Fried Rice", "Gobi Manchurian", "Sweet Lassi"],
      replied: true,
      reply:
        "Thank you for your wonderful review, Sarah! We're thrilled to be your go-to place for Indian-Chinese fusion cuisine.",
      helpful: 15,
      unhelpful: 0,
    },
    {
      id: 5,
      customer: "David Lee",
      avatar: "/placeholder.svg?height=40&width=40",
      rating: 2,
      date: "1 month ago",
      comment:
        "Disappointed with my order. The Chicken 65 was dry and the rice was cold when it arrived. The dessert was good though.",
      order: ["Chicken 65", "Garlic Rice", "Gulab Jamun"],
      replied: true,
      reply:
        "We're very sorry about your experience, David. This is not our usual standard of service. We'd like to make it up to you - please check your email for a special offer on your next order.",
      helpful: 3,
      unhelpful: 7,
    },
  ]

  const renderStars = (rating: number) => {
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Customer Reviews</h1>
        <p className="text-muted-foreground">Monitor and respond to customer feedback about your restaurant.</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full max-w-sm items-center space-x-2">
          <Input
            type="search"
            placeholder="Search reviews..."
            className="w-full"
          />
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Select defaultValue="all">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by rating" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratings</SelectItem>
              <SelectItem value="5">5 Stars</SelectItem>
              <SelectItem value="4">4 Stars</SelectItem>
              <SelectItem value="3">3 Stars</SelectItem>
              <SelectItem value="2">2 Stars</SelectItem>
              <SelectItem value="1">1 Star</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="recent">
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="highest">Highest Rating</SelectItem>
              <SelectItem value="lowest">Lowest Rating</SelectItem>
              <SelectItem value="helpful">Most Helpful</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Rating Summary</CardTitle>
            <CardDescription>Overall customer satisfaction</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              <div className="text-5xl font-bold">4.2</div>
              <div className="mt-2 flex">{renderStars(4)}</div>
              <p className="mt-1 text-sm text-muted-foreground">Based on 128 reviews</p>
              <Separator className="my-4" />
              <div className="w-full space-y-2">
                {[5, 4, 3, 2, 1].map((rating) => (
                  <div key={rating} className="flex items-center gap-2">
                    <div className="flex w-12 justify-end">
                      <span className="text-sm">{rating} stars</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{
                          width: `${rating === 5 ? 65 : rating === 4 ? 20 : rating === 3 ? 10 : rating === 2 ? 3 : 2}%`,
                        }}
                      ></div>
                    </div>
                    <div className="w-8 text-right text-sm">
                      {rating === 5 ? 65 : rating === 4 ? 20 : rating === 3 ? 10 : rating === 2 ? 3 : 2}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Recent Reviews</CardTitle>
            <CardDescription>Customer feedback from the past month</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                <TabsTrigger value="all">All Reviews</TabsTrigger>
                <TabsTrigger value="unreplied">Needs Reply</TabsTrigger>
                <TabsTrigger value="replied">Replied</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-6 pt-4">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={review.avatar} alt={review.customer} />
                          <AvatarFallback>{review.customer.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{review.customer}</h3>
                            <Badge
                              variant={
                                review.rating >= 4 ? "default" : review.rating >= 3 ? "secondary" : "destructive"
                              }
                            >
                              {review.rating} Star
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{review.date}</p>
                          <div className="mt-1 text-sm">
                            <span className="font-medium">Ordered: </span>
                            {review.order.join(", ")}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-3 flex gap-1">{renderStars(review.rating)}</div>
                    <p className="mt-2 text-sm">{review.comment}</p>

                    {review.replied && (
                      <div className="mt-3 rounded-md bg-muted p-3">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Your Reply</span>
                        </div>
                        <p className="mt-1 text-sm">{review.reply}</p>
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-8 px-2">
                            <ThumbsUp className="mr-1 h-4 w-4" />
                            <span>{review.helpful}</span>
                          </Button>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-8 px-2">
                            <ThumbsDown className="mr-1 h-4 w-4" />
                            <span>{review.unhelpful}</span>
                          </Button>
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 px-2">
                          <Flag className="mr-1 h-4 w-4" />
                          <span>Report</span>
                        </Button>
                      </div>
                      {!review.replied && (
                        <Button size="sm">
                          <MessageCircle className="mr-2 h-4 w-4" />
                          Reply
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="unreplied" className="space-y-6 pt-4">
                {reviews
                  .filter((review) => !review.replied)
                  .map((review) => (
                    <div key={review.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={review.avatar} alt={review.customer} />
                            <AvatarFallback>{review.customer.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{review.customer}</h3>
                              <Badge
                                variant={
                                  review.rating >= 4 ? "default" : review.rating >= 3 ? "secondary" : "destructive"
                                }
                              >
                                {review.rating} Star
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{review.date}</p>
                            <div className="mt-1 text-sm">
                              <span className="font-medium">Ordered: </span>
                              {review.order.join(", ")}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-3 flex gap-1">{renderStars(review.rating)}</div>
                      <p className="mt-2 text-sm">{review.comment}</p>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-8 px-2">
                              <ThumbsUp className="mr-1 h-4 w-4" />
                              <span>{review.helpful}</span>
                            </Button>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-8 px-2">
                              <ThumbsDown className="mr-1 h-4 w-4" />
                              <span>{review.unhelpful}</span>
                            </Button>
                          </div>
                          <Button variant="ghost" size="sm" className="h-8 px-2">
                            <Flag className="mr-1 h-4 w-4" />
                            <span>Report</span>
                          </Button>
                        </div>
                        <Button size="sm">
                          <MessageCircle className="mr-2 h-4 w-4" />
                          Reply
                        </Button>
                      </div>
                    </div>
                  ))}
                {reviews.filter((review) => !review.replied).length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10">
                    <div className="rounded-full bg-primary/10 p-3">
                      <MessageCircle className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mt-4 text-lg font-medium">All Caught Up!</h3>
                    <p className="mt-2 text-center text-sm text-muted-foreground">
                      You've replied to all customer reviews. Great job!
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="replied" className="space-y-6 pt-4">
                {reviews
                  .filter((review) => review.replied)
                  .map((review) => (
                    <div key={review.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={review.avatar} alt={review.customer} />
                            <AvatarFallback>{review.customer.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{review.customer}</h3>
                              <Badge
                                variant={
                                  review.rating >= 4 ? "default" : review.rating >= 3 ? "secondary" : "destructive"
                                }
                              >
                                {review.rating} Star
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{review.date}</p>
                            <div className="mt-1 text-sm">
                              <span className="font-medium">Ordered: </span>
                              {review.order.join(", ")}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-3 flex gap-1">{renderStars(review.rating)}</div>
                      <p className="mt-2 text-sm">{review.comment}</p>

                      <div className="mt-3 rounded-md bg-muted p-3">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Your Reply</span>
                        </div>
                        <p className="mt-1 text-sm">{review.reply}</p>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-8 px-2">
                              <ThumbsUp className="mr-1 h-4 w-4" />
                              <span>{review.helpful}</span>
                            </Button>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-8 px-2">
                              <ThumbsDown className="mr-1 h-4 w-4" />
                              <span>{review.unhelpful}</span>
                            </Button>
                          </div>
                          <Button variant="ghost" size="sm" className="h-8 px-2">
                            <Flag className="mr-1 h-4 w-4" />
                            <span>Report</span>
                          </Button>
                        </div>
                        <Button variant="outline" size="sm">
                          <MessageCircle className="mr-2 h-4 w-4" />
                          Edit Reply
                        </Button>
                      </div>
                    </div>
                  ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

